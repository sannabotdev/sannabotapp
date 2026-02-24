/**
 * FileStorageTool – Simple persistent file storage backed by AsyncStorage
 *
 * Provides four actions:
 *   read   – Read a file's content by name
 *   write  – Write (overwrite) a file's content
 *   list   – List all stored file names
 *   delete – Delete a file
 *
 * AsyncStorage key convention: `sanna_file_<filename>`
 *
 * Used by the "lists" skill to persist shopping lists, to-do lists, etc.
 * The skill layer is responsible for the data format (one item per line).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';

const FILE_KEY_PREFIX = 'sanna_file_';

type FileAction = 'read' | 'write' | 'list' | 'delete';

export class FileStorageTool implements Tool {
  name(): string {
    return 'file_storage';
  }

  description(): string {
    return (
      'Einfache Datei-Ablage im Gerätespeicher: Textdateien lesen, schreiben, auflisten und löschen. ' +
      'Wird genutzt, um Listen (Einkaufsliste, To-do etc.) lokal zu speichern.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'write', 'list', 'delete'],
          description:
            'read: Dateiinhalt lesen. ' +
            'write: Dateiinhalt schreiben (überschreibt). ' +
            'list: Alle gespeicherten Dateinamen auflisten. ' +
            'delete: Eine Datei löschen.',
        },
        filename: {
          type: 'string',
          description:
            'Dateiname ohne Pfad oder Endung, z.B. "einkaufsliste". ' +
            'Nur Kleinbuchstaben, Ziffern und Bindestriche. ' +
            'Erforderlich für read, write und delete.',
        },
        content: {
          type: 'string',
          description:
            'Vollständiger Dateiinhalt, der gespeichert werden soll. ' +
            'Nur für action=write. Für Listen: ein Eintrag pro Zeile.',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as FileAction;

    try {
      switch (action) {
        case 'read':
          return this.readFile(args.filename as string);
        case 'write':
          return this.writeFile(args.filename as string, args.content as string);
        case 'list':
          return this.listFiles();
        case 'delete':
          return this.deleteFile(args.filename as string);
        default:
          return errorResult(`Unbekannte Aktion: ${String(action)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`FileStorage-Fehler: ${message}`);
    }
  }

  private sanitizeFilename(filename: string | undefined): string | null {
    if (!filename || typeof filename !== 'string') return null;
    // Allow letters (incl. umlauts), digits, hyphens and underscores
    const clean = filename.trim().toLowerCase();
    if (clean.length === 0) return null;
    return clean;
  }

  private async readFile(filename: string | undefined): Promise<ToolResult> {
    const name = this.sanitizeFilename(filename);
    if (!name) {
      return errorResult('"filename" Parameter fehlt oder ist ungültig.');
    }

    const key = `${FILE_KEY_PREFIX}${name}`;
    const value = await AsyncStorage.getItem(key);

    if (value === null) {
      return successResult(`Datei "${name}" existiert nicht oder ist leer.`);
    }

    return successResult(`Inhalt von "${name}":\n${value}`);
  }

  private async writeFile(
    filename: string | undefined,
    content: string | undefined,
  ): Promise<ToolResult> {
    const name = this.sanitizeFilename(filename);
    if (!name) {
      return errorResult('"filename" Parameter fehlt oder ist ungültig.');
    }
    if (typeof content !== 'string') {
      return errorResult('"content" Parameter fehlt.');
    }

    const key = `${FILE_KEY_PREFIX}${name}`;
    await AsyncStorage.setItem(key, content);

    const lineCount = content.split('\n').filter(l => l.trim().length > 0).length;
    return successResult(
      `Datei "${name}" gespeichert (${lineCount} Einträge).`,
    );
  }

  private async listFiles(): Promise<ToolResult> {
    const allKeys = await AsyncStorage.getAllKeys();
    const fileKeys = (allKeys as readonly string[]).filter(k =>
      k.startsWith(FILE_KEY_PREFIX),
    );

    if (fileKeys.length === 0) {
      return successResult('Keine Dateien gespeichert.');
    }

    const names = fileKeys.map(k => k.slice(FILE_KEY_PREFIX.length));
    return successResult(
      `Gespeicherte Dateien (${names.length}):\n${names.map(n => `- ${n}`).join('\n')}`,
    );
  }

  private async deleteFile(filename: string | undefined): Promise<ToolResult> {
    const name = this.sanitizeFilename(filename);
    if (!name) {
      return errorResult('"filename" Parameter fehlt oder ist ungültig.');
    }

    const key = `${FILE_KEY_PREFIX}${name}`;
    const existing = await AsyncStorage.getItem(key);
    if (existing === null) {
      return successResult(`Datei "${name}" existiert nicht (nichts zu löschen).`);
    }

    await AsyncStorage.removeItem(key);
    return successResult(`Datei "${name}" wurde gelöscht.`);
  }
}

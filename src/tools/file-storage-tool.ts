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
const TYPE_KEY_PREFIX = 'sanna_file_';
const TYPE_KEY_SUFFIX = '_type';

type FileAction = 'read' | 'write' | 'list' | 'delete';
type FileType = 'list' | 'text' | 'binary';

export class FileStorageTool implements Tool {
  name(): string {
    return 'file_storage';
  }

  description(): string {
    return (
      'Simple file storage on the device: read, write, list, and delete files. ' +
      'Supports three file types: "list" (for lists), "text" (plain text), and "binary" (base64 encoded). ' +
      'Used to persist lists (shopping list, to-do, etc.) locally.'
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
            'read: Read file content. ' +
            'write: Write file content (overwrites). ' +
            'list: List all stored file names. ' +
            'delete: Delete a file.',
        },
        filename: {
          type: 'string',
          description:
            'File name without path or extension, e.g. "shopping-list". ' +
            'Lowercase letters, digits, and hyphens only. ' +
            'Required for read, write, and delete.',
        },
        content: {
          type: 'string',
          description:
            'Full file content to store. ' +
            'Only for action=write. For lists: one entry per line. ' +
            'For binary type: content will be base64 encoded automatically.',
        },
        type: {
          type: 'string',
          enum: ['list', 'text', 'binary'],
          description:
            'File type: "list" for list files (one item per line), ' +
            '"text" for plain text files, "binary" for binary data (base64 encoded). ' +
            'Defaults to "text" if not specified.',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as FileAction;
    const fileType = (args.type as FileType | undefined) || 'text';

    try {
      switch (action) {
        case 'read':
          return this.readFile(args.filename as string, fileType);
        case 'write':
          return this.writeFile(
            args.filename as string,
            args.content as string,
            fileType,
          );
        case 'list':
          return this.listFiles();
        case 'delete':
          return this.deleteFile(args.filename as string);
        default:
          return errorResult(`Unknown action: ${String(action)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`FileStorage error: ${message}`);
    }
  }

  private sanitizeFilename(filename: string | undefined): string | null {
    if (!filename || typeof filename !== 'string') return null;
    // Allow letters (incl. umlauts), digits, hyphens and underscores
    const clean = filename.trim().toLowerCase();
    if (clean.length === 0) return null;
    return clean;
  }

  private async getFileType(name: string): Promise<FileType> {
    const typeKey = `${TYPE_KEY_PREFIX}${name}${TYPE_KEY_SUFFIX}`;
    const storedType = await AsyncStorage.getItem(typeKey);
    if (storedType === 'list' || storedType === 'text' || storedType === 'binary') {
      return storedType as FileType;
    }
    // Backward compatibility: if no type stored, default to "text"
    return 'text';
  }

  private async setFileType(name: string, fileType: FileType): Promise<void> {
    const typeKey = `${TYPE_KEY_PREFIX}${name}${TYPE_KEY_SUFFIX}`;
    await AsyncStorage.setItem(typeKey, fileType);
  }

  private async readFile(
    filename: string | undefined,
    fileType: FileType,
  ): Promise<ToolResult> {
    const name = this.sanitizeFilename(filename);
    if (!name) {
      return errorResult('Missing or invalid "filename" parameter.');
    }

    const key = `${FILE_KEY_PREFIX}${name}`;
    const value = await AsyncStorage.getItem(key);

    if (value === null) {
      return successResult(`File "${name}" does not exist or is empty.`);
    }

    // Get the actual stored type (may differ from requested type)
    const storedType = await this.getFileType(name);

    let content = value;
    if (storedType === 'binary') {
      try {
        content = atob(value);
      } catch (err) {
        return errorResult(
          `Failed to decode binary file "${name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return successResult(`Content of "${name}":\n${content}`);
  }

  private async writeFile(
    filename: string | undefined,
    content: string | undefined,
    fileType: FileType,
  ): Promise<ToolResult> {
    const name = this.sanitizeFilename(filename);
    if (!name) {
      return errorResult('Missing or invalid "filename" parameter.');
    }
    if (typeof content !== 'string') {
      return errorResult('Missing "content" parameter.');
    }

    const key = `${FILE_KEY_PREFIX}${name}`;
    let contentToStore = content;

    // Encode to base64 if binary type
    if (fileType === 'binary') {
      try {
        contentToStore = btoa(content);
      } catch (err) {
        return errorResult(
          `Failed to encode binary content: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await AsyncStorage.setItem(key, contentToStore);
    await this.setFileType(name, fileType);

    if (fileType === 'list') {
      const lineCount = content.split('\n').filter(l => l.trim().length > 0).length;
      return successResult(
        `File "${name}" saved (${lineCount} entries).`,
      );
    } else {
      return successResult(`File "${name}" saved.`);
    }
  }

  private async listFiles(): Promise<ToolResult> {
    const allKeys = await AsyncStorage.getAllKeys();
    const fileKeys = (allKeys as readonly string[]).filter(k =>
      k.startsWith(FILE_KEY_PREFIX),
    );

    if (fileKeys.length === 0) {
      return successResult('No files stored.');
    }

    const names = fileKeys.map(k => k.slice(FILE_KEY_PREFIX.length));
    return successResult(
      `Stored files (${names.length}):\n${names.map(n => `- ${n}`).join('\n')}`,
    );
  }

  private async deleteFile(filename: string | undefined): Promise<ToolResult> {
    const name = this.sanitizeFilename(filename);
    if (!name) {
      return errorResult('Missing or invalid "filename" parameter.');
    }

    const key = `${FILE_KEY_PREFIX}${name}`;
    const existing = await AsyncStorage.getItem(key);
    if (existing === null) {
      return successResult(`File "${name}" does not exist (nothing to delete).`);
    }

    // Delete both the file and its type metadata
    await AsyncStorage.removeItem(key);
    const typeKey = `${TYPE_KEY_PREFIX}${name}${TYPE_KEY_SUFFIX}`;
    await AsyncStorage.removeItem(typeKey);
    return successResult(`File "${name}" deleted.`);
  }
}

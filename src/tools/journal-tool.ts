/**
 * JournalTool – Create, read, and manage journal entries
 *
 * Journal entries can track activities, events, and notes with optional date ranges.
 * Supports: create, list, get, delete, list_by_category
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import { addEntry, getEntries, getEntry, deleteEntry, getEntriesByCategory, getCategories } from '../agent/journal-store';

type JournalAction = 'create' | 'list' | 'get' | 'delete' | 'list_by_category';

export class JournalTool implements Tool {
  name(): string {
    return 'journal';
  }

  description(): string {
    return [
      'Create, read, and manage journal entries.',
      'Journal entries track activities, events, and notes with optional date ranges.',
      'Each entry has: creation timestamp, optional date from/to, category, title, and details.',
      'Actions: create, list (all entries), get (single entry), delete, list_by_category.',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'list', 'get', 'delete', 'list_by_category'],
          description: 'Action: create, list (all entries), get (single), delete, list_by_category',
        },
        title: {
          type: 'string',
          description: 'Title/heading for the journal entry (required for create)',
        },
        category: {
          type: 'string',
          description: 'Category for the journal entry (required for create, optional for list_by_category)',
        },
        details: {
          type: 'string',
          description: 'Details/description for the journal entry (required for create)',
        },
        date_from: {
          type: 'number',
          description: 'Optional: Start date as Unix timestamp in milliseconds',
        },
        date_to: {
          type: 'number',
          description: 'Optional: End date as Unix timestamp in milliseconds',
        },
        entry_id: {
          type: 'string',
          description: 'Entry ID (required for get/delete)',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as JournalAction;

    switch (action) {
      case 'create':
        return this.createEntry(args);
      case 'list':
        return this.listEntries();
      case 'get':
        return this.getEntry(args);
      case 'delete':
        return this.deleteEntry(args);
      case 'list_by_category':
        return this.listByCategory(args);
      default:
        return errorResult(`Unknown action: ${action}`);
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────

  private async createEntry(args: Record<string, unknown>): Promise<ToolResult> {
    const title = args.title as string;
    const category = args.category as string;
    const details = args.details as string;
    const dateFrom = args.date_from as number | undefined;
    const dateTo = args.date_to as number | undefined;

    if (!title) {
      return errorResult('Missing title parameter');
    }
    if (!category) {
      return errorResult('Missing category parameter');
    }
    if (!details) {
      return errorResult('Missing details parameter');
    }

    try {
      const entry = await addEntry({
        title,
        category,
        details,
        dateFrom,
        dateTo,
      });

      return successResult(
        `Journal entry created: ${entry.id}\nTitle: ${entry.title}\nCategory: ${entry.category}`,
        `Journal entry created: ${entry.title}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to create journal entry: ${errMsg}`);
    }
  }

  // ── List ────────────────────────────────────────────────────────────────

  private async listEntries(): Promise<ToolResult> {
    try {
      const entries = await getEntries();

      if (entries.length === 0) {
        return successResult(
          'No journal entries found.',
          'You have no journal entries',
        );
      }

      const lines = entries.map(e => this.formatEntryListItem(e));
      return successResult(
        `${entries.length} journal entry(ies):\n${lines.join('\n')}`,
        `You have ${entries.length} journal entry(ies)`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to list journal entries: ${errMsg}`);
    }
  }

  // ── Get ─────────────────────────────────────────────────────────────────

  private async getEntry(args: Record<string, unknown>): Promise<ToolResult> {
    const entryId = args.entry_id as string;

    if (!entryId) {
      return errorResult('Missing entry_id parameter');
    }

    try {
      const entry = await getEntry(entryId);
      if (!entry) {
        return errorResult(`Journal entry not found: ${entryId}`);
      }

      return successResult(
        this.formatEntryDetail(entry),
        `Journal entry: ${entry.title}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to get journal entry: ${errMsg}`);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  private async deleteEntry(args: Record<string, unknown>): Promise<ToolResult> {
    const entryId = args.entry_id as string;

    if (!entryId) {
      return errorResult('Missing entry_id parameter');
    }

    try {
      const deleted = await deleteEntry(entryId);
      if (!deleted) {
        return errorResult(`Journal entry not found: ${entryId}`);
      }

      return successResult(
        `Journal entry deleted: ${entryId}`,
        'Journal entry deleted',
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to delete journal entry: ${errMsg}`);
    }
  }

  // ── List by Category ────────────────────────────────────────────────────

  private async listByCategory(args: Record<string, unknown>): Promise<ToolResult> {
    const category = args.category as string | undefined;

    if (!category) {
      return errorResult('Missing category parameter for list_by_category');
    }

    try {
      const entries = await getEntriesByCategory(category);

      if (entries.length === 0) {
        return successResult(
          `No journal entries found in category "${category}".`,
          `No entries in category "${category}"`,
        );
      }

      const lines = entries.map(e => this.formatEntryListItem(e));
      return successResult(
        `${entries.length} journal entry(ies) in category "${category}":\n${lines.join('\n')}`,
        `${entries.length} entries in category "${category}"`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to list journal entries by category: ${errMsg}`);
    }
  }

  // ── Formatting ──────────────────────────────────────────────────────────

  private formatEntryListItem(entry: { id: string; createdAt: number; category: string; title: string }): string {
    const date = new Date(entry.createdAt).toLocaleString();
    return `[${entry.id}] ${date} | ${entry.category} | ${entry.title}`;
  }

  private formatEntryDetail(entry: { id: string; createdAt: number; dateFrom?: number; dateTo?: number; category: string; title: string; details: string }): string {
    const lines: string[] = [];
    lines.push(`ID: ${entry.id}`);
    lines.push(`Created: ${new Date(entry.createdAt).toLocaleString()}`);
    if (entry.dateFrom) {
      lines.push(`Date From: ${new Date(entry.dateFrom).toLocaleDateString()}`);
    }
    if (entry.dateTo) {
      lines.push(`Date To: ${new Date(entry.dateTo).toLocaleDateString()}`);
    }
    lines.push(`Category: ${entry.category}`);
    lines.push(`Title: ${entry.title}`);
    lines.push(`Details: ${entry.details}`);
    return lines.join('\n');
  }
}

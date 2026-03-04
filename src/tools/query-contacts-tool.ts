/**
 * QueryContactsTool – Search local device contacts (offline, no internet required)
 *
 * Uses DeviceQueryModule native bridge
 */
import { NativeModules } from 'react-native';
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';

const { DeviceQueryModule } = NativeModules;

interface ContactEntry { name: string; number: string; type: number }

export class QueryContactsTool implements Tool {
  name(): string {
    return 'query_contacts';
  }

  description(): string {
    return 'Search local device contacts by name. No internet required.';
  }

  systemHint(): string {
    return 'Always look up contacts by name here before sending SMS or making calls — you need the phone number. Also useful for checking if a contact exists and finding their number.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (contact name)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: [],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = (args.query as string) ?? '';
    const limit = (args.limit as number) ?? 10;

    try {
      const contacts: ContactEntry[] = query
        ? await DeviceQueryModule.searchContacts(query, limit)
        : await DeviceQueryModule.searchContacts('', limit);

      if (!contacts || contacts.length === 0) {
        return successResult(query ? `No contacts found for "${query}".` : 'No contacts available.');
      }

      const lines = contacts.map(c => `- ${c.name}: ${c.number}`);
      return successResult(
        `Contacts (${contacts.length}):\n${lines.join('\n')}`,
        contacts.length === 1 ? `${contacts[0].name}: ${contacts[0].number}` : undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Query contacts failed: ${message}`);
    }
  }
}

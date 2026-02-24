/**
 * QueryTool – Local device data queries (offline, no internet required)
 *
 * Queries: Contacts, SMS, Call log
 * Uses DeviceQueryModule native bridge
 */
import { NativeModules } from 'react-native';
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';

const { DeviceQueryModule } = NativeModules;

type QueryType = 'contacts' | 'sms' | 'call_log';

interface ContactEntry { name: string; number: string; type: number }
interface SMSEntry { address: string; body: string; date: number; type: number }
interface CallEntry { number: string; name: string; date: number; duration: number; type: string }

export class QueryTool implements Tool {
  name(): string {
    return 'query';
  }

  description(): string {
    return 'Query local device data: contacts, SMS inbox, call log. No internet required.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['contacts', 'sms', 'call_log'],
          description: 'What to query',
        },
        query: {
          type: 'string',
          description: 'Search term (for contacts: name; for sms: sender or content)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: ['type'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const type = args.type as QueryType;
    const query = (args.query as string) ?? '';
    const limit = (args.limit as number) ?? 10;

    try {
      switch (type) {
        case 'contacts':
          return this.queryContacts(query, limit);
        case 'sms':
          return this.querySMS(query, limit);
        case 'call_log':
          return this.queryCallLog(limit);
        default:
          return errorResult(`Unknown type: ${type}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Query failed: ${message}`);
    }
  }

  private async queryContacts(query: string, limit: number): Promise<ToolResult> {
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
  }

  private async querySMS(query: string, limit: number): Promise<ToolResult> {
    const messages: SMSEntry[] = query
      ? await DeviceQueryModule.searchSMS(query, limit)
      : await DeviceQueryModule.getRecentSMS(limit);

    if (!messages || messages.length === 0) {
      return successResult('No SMS found.');
    }

    const lines = messages.map(m => {
      const date = new Date(m.date).toLocaleString('en-US');
      const type = m.type === 1 ? 'Received' : 'Sent';
      return `[${date}] ${type} from/to ${m.address}: ${m.body.slice(0, 100)}`;
    });

    return successResult(`SMS (${messages.length}):\n${lines.join('\n')}`);
  }

  private async queryCallLog(limit: number): Promise<ToolResult> {
    const calls: CallEntry[] = await DeviceQueryModule.getRecentCalls(limit);

    if (!calls || calls.length === 0) {
      return successResult('No calls in history.');
    }

    const typeLabel: Record<string, string> = {
      incoming: 'Incoming',
      outgoing: 'Outgoing',
      missed: 'Missed',
    };

    const lines = calls.map(c => {
      const date = new Date(c.date).toLocaleString('en-US');
      const name = c.name || c.number;
      const type = typeLabel[c.type] ?? c.type;
      const dur = c.duration > 0 ? ` (${c.duration}s)` : '';
      return `[${date}] ${type}: ${name}${dur}`;
    });

    return successResult(`Call log (${calls.length}):\n${lines.join('\n')}`);
  }
}

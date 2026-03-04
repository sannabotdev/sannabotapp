/**
 * QuerySmsTool – Search local device SMS messages (offline, no internet required)
 *
 * Uses DeviceQueryModule native bridge
 */
import { NativeModules } from 'react-native';
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';

const { DeviceQueryModule } = NativeModules;

interface SMSEntry { address: string; body: string; date: number; type: number }

export class QuerySmsTool implements Tool {
  name(): string {
    return 'query_sms';
  }

  description(): string {
    return 'Search local device SMS messages by sender or content. No internet required.';
  }

  systemHint(): string {
    return 'Search SMS messages by sender or content. Useful for finding recently received or sent messages, or checking if a specific message exists.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (sender or content)',
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Query SMS failed: ${message}`);
    }
  }
}

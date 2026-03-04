/**
 * QueryCallLogTool – Query local device call log (offline, no internet required)
 *
 * Uses DeviceQueryModule native bridge
 */
import { NativeModules } from 'react-native';
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';

const { DeviceQueryModule } = NativeModules;

interface CallEntry { number: string; name: string; date: number; duration: number; type: string }

export class QueryCallLogTool implements Tool {
  name(): string {
    return 'query_call_log';
  }

  description(): string {
    return 'Query local device call log. Shows recently made, received, and missed calls. No internet required.';
  }

  systemHint(): string {
    return 'Shows the call log with recently made, received, and missed calls. Useful for checking who called recently or reviewing call history.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: [],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const limit = (args.limit as number) ?? 10;

    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Query call log failed: ${message}`);
    }
  }
}

/**
 * IntentTool – Android Intent execution tool
 *
 * Allows the LLM to open/control Android apps via Intents.
 * Used by skills: google-maps, phone, sms, whatsapp, spotify (playback), etc.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import IntentModule from '../native/IntentModule';

export class IntentTool implements Tool {
  name(): string {
    return 'intent';
  }

  description(): string {
    return 'Control Android apps via Intents. Opens apps, starts navigation, makes calls, sends SMS, etc.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description:
            'Intent action (e.g. "android.intent.action.VIEW", "android.intent.action.CALL", "android.intent.action.SENDTO")',
        },
        uri: {
          type: 'string',
          description:
            'URI for the intent (e.g. "google.navigation:q=Vienna", "tel:+43...", "smsto:+43...")',
        },
        package: {
          type: 'string',
          description: 'Optional target package (e.g. "com.google.android.apps.maps")',
        },
        extras: {
          type: 'array',
          description: 'Optional intent extras as a list of key/value pairs.',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Extra name' },
              value: { type: 'string', description: 'Extra value' },
            },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as string;
    const uri = (args.uri as string) ?? null;
    const pkg = (args.package as string) ?? null;
    const extrasArr = (args.extras as { key: string; value: string }[]) ?? [];
    const extras: Record<string, string> | null = extrasArr.length > 0
      ? Object.fromEntries(extrasArr.map(e => [e.key, e.value]))
      : null;

    if (!action) {
      return errorResult('action parameter is required');
    }

    try {
      await IntentModule.sendIntent(action, uri, pkg, extras);
      const description = uri ? `${action} → ${uri}` : action;
      return successResult(
        `Intent executed: ${description}`,
        undefined, // Don't speak "Intent executed" – LLM will say what happened
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Intent failed: ${message}`);
    }
  }
}

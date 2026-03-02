/**
 * AccessibilityHintTool – Allows the LLM to add user-provided accessibility hints for apps.
 *
 * When the user says something like "In App XYZ you need to do Y to achieve Z",
 * the LLM can call this tool to integrate the user hint with existing learned hints.
 * The user hint has higher priority and can override existing hints.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import { AccessibilityHintStore } from '../agent/accessibility-hint-store';
import type { LLMProvider } from '../llm/types';

export class AccessibilityHintTool implements Tool {
  private provider?: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider;
  }

  name(): string {
    return 'accessibility_hint_user';
  }

  description(): string {
    return (
      'Add or update accessibility hints for an Android app based on user instructions. ' +
      'Use this when the user provides specific guidance about how to interact with an app ' +
      '(e.g. "In WhatsApp you need to click the search icon first, then type the contact name"). ' +
      'The user-provided hint will be integrated with existing learned hints, with the user hint ' +
      'taking higher priority and able to override existing hints.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description:
            'Android package name of the target app (e.g. "com.whatsapp", "com.android.mms")',
        },
        hint: {
          type: 'string',
          description:
            'User-provided hint describing how to interact with the app. ' +
            'Should describe the steps in natural language using button labels and UI element descriptions. ' +
            'Example: "To send a message, first click the search icon, then type the contact name, then tap the contact, then type the message and tap Send."',
          minLength: 10,
        },
      },
      required: ['package_name', 'hint'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const packageName = args.package_name as string;
    const hint = args.hint as string;

    if (!packageName) {
      return errorResult('"package_name" parameter is required');
    }
    if (!hint || typeof hint !== 'string' || hint.trim().length < 10) {
      return errorResult('"hint" parameter is required and must be at least 10 characters');
    }

    if (!this.provider) {
      return errorResult('LLM provider not available for accessibility hint operations.');
    }

    try {
      await AccessibilityHintStore.condenseWithUserHint(packageName, hint.trim(), this.provider);
      return successResult(
        `Accessibility hint added for "${packageName}". The hint has been integrated with existing learned hints.`,
        `Hint für ${packageName} hinzugefügt.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to add accessibility hint: ${message}`);
    }
  }
}

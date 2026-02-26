/**
 * AccessibilityTool – LLM-driven UI automation for any Android app
 *
 * Instead of running the automation in the main JS context (which gets
 * throttled when SannaBot goes to the background), this tool starts an
 * Android HeadlessJsTaskService that runs the full automation in a separate
 * JS context specifically designed for background execution.
 *
 * Flow:
 *   1. Check Accessibility Service is enabled
 *   2. Serialize job parameters to JSON
 *   3. Start AccessibilityHeadlessService (→ triggers SannaAccessibilityTask)
 *   4. Return immediately – the result will be spoken via TTS when done
 *
 * Skills reference this tool when they need to interact with an app's UI
 * directly (e.g. send a WhatsApp message by actually pressing the Send button).
 *
 * Requires the user to enable "Sanna" in Android Settings → Accessibility.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import AccessibilityModule from '../native/AccessibilityModule';
import AccessibilityJobModule from '../native/AccessibilityJobModule';

export class AccessibilityTool implements Tool {
  name(): string {
    return 'accessibility';
  }

  description(): string {
    return (
      'Open an Android app and let the LLM sub-agent perform UI actions to achieve a goal ' +
      '(e.g. send a WhatsApp message, fill a form). ' +
      'Runs in the background – the result is announced via voice when done. ' +
      'Requires Accessibility Service to be enabled by the user.'
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
        goal: {
          type: 'string',
          description:
            'Natural-language description of what to do inside the app. ' +
            'Be precise: include the message text, contact name, button labels, etc. ' +
            'Example: "Type \'Hello John!\' into the message field and tap the Send button."',
        },
        intent_action: {
          type: 'string',
          description:
            'Optional Intent action to open the app or a specific screen ' +
            '(e.g. "android.intent.action.VIEW"). Omit if the app is already open.',
        },
        intent_uri: {
          type: 'string',
          description:
            'Optional URI for the Intent (e.g. "https://wa.me/436601234567?text=Hello"). ' +
            'Required when intent_action is provided and a URI is needed.',
        },
      },
      required: ['package_name', 'goal'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const packageName = args.package_name as string;
    const goal = args.goal as string;
    const intentAction = (args.intent_action as string | undefined) ?? null;
    const intentUri = (args.intent_uri as string | undefined) ?? null;

    if (!packageName) {
      return errorResult('"package_name" parameter is required');
    }
    if (!goal) {
      return errorResult('"goal" parameter is required');
    }

    // ── Check Accessibility Service ──────────────────────────────────────
    let serviceEnabled: boolean;
    try {
      serviceEnabled = await AccessibilityModule.isAccessibilityServiceEnabled();
    } catch {
      serviceEnabled = false;
    }

    if (!serviceEnabled) {
      return errorResult(
        'The Sanna Accessibility Service is not enabled. ' +
        'Please go to Android Settings → Accessibility → Sanna and enable it. ' +
        'This is required for automated UI interactions.',
      );
    }

    // ── Start HeadlessJS background task ────────────────────────────────
    // The actual automation (open app → wait → read tree → LLM loop) runs
    // inside SannaAccessibilityTask via HeadlessJsTaskService.  The JS runtime
    // there is NOT throttled when SannaBot is in the background, unlike the
    // main UI JS context.
    const job = {
      packageName,
      goal,
      intentAction,
      intentUri,
    };

    try {
      await AccessibilityJobModule.startJob(JSON.stringify(job));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to start background automation task: ${msg}`);
    }

    // Return a success result. The tool loop makes one more LLM call which –
    // using the existing system prompt (language, driving mode, persona) –
    // naturally produces a short, well-formatted confirmation for the user.
    // The real result arrives later via ConversationStore.appendPending.
    return successResult(
      `Background UI automation started for "${packageName}". Task is running in background.`,
    );
  }
}

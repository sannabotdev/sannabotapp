/**
 * AccessibilityTool – LLM-driven UI automation for any Android app
 *
 * Starts a HeadlessJS task that runs in a separate JS context (not throttled
 * when SannaBot goes to background). The result is announced via voice when done.
 *
 * Flow:
 *   1. Check Accessibility Service is enabled
 *   2. Start HeadlessJS task (runs in background)
 *   3. Return immediately – the result will be spoken via TTS when done
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
import { SILENT_REPLY_TOKEN } from '../agent/tokens';

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

  systemHint(): string {
    return 'Use when no direct API/skill exists for the target app. A sub-agent will tap, type, and swipe in the app UI. Always call skill_detail first to get the exact package name and goal format.';
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

    // Return SILENT_REPLY_TOKEN to tell the agent not to generate a response yet.
    // The actual result will come via appendPending when the background task completes.
    // The tool loop will detect this token and stop without generating a user-facing response.
    return successResult(
      `${SILENT_REPLY_TOKEN} Background UI automation task started for "${packageName}". The result will be delivered separately when the task completes.`,
      undefined, // No forUser - don't speak this
    );
  }
}

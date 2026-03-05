/**
 * AccessibilityTool – LLM-driven UI automation for any Android app
 *
 * Starts an asynchronous background task that runs in a separate JS context (not throttled
 * when SannaBot goes to background). The result is delivered to SannaBot later via appendPending.
 *
 * IMPORTANT: This tool does NOT wait for the result. It starts a background task and returns
 * immediately. The result will be delivered asynchronously when the background task completes.
 * This tool should typically be the LAST tool call in a tool loop, as any subsequent tool calls
 * would execute before the accessibility automation finishes.
 *
 * Flow:
 *   1. Check Accessibility Service is enabled
 *   2. Start HeadlessJS background task (runs asynchronously)
 *   3. Return immediately – the result will be delivered later via appendPending
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
      'IMPORTANT: This tool starts a background task asynchronously – it does NOT wait for the result. ' +
      'The result will be delivered to SannaBot later when the background task completes. ' +
      'This tool should typically be the LAST tool call in a tool loop, as any subsequent tool calls ' +
      'would execute before the accessibility automation finishes. ' +
      'Requires Accessibility Service to be enabled by the user.'
    );
  }

  systemHint(): string {
    return (
      'Use when no direct API/skill exists for the target app. A sub-agent will tap, type, and swipe in the app UI. ' +
      'Always call skill_detail first to get the exact package name and goal format. ' +
      'CRITICAL: This tool starts an asynchronous background task – the result arrives later via appendPending. ' +
      'Do NOT call any other tools after this one, as they would execute before the automation completes. ' +
      'This should be the final tool call in your tool loop.'
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

    return successResult(
      `Background UI automation task started for "${packageName}". The result will be delivered separately when the task completes.`,
      undefined, // No forUser - don't speak this
    );
  }
}

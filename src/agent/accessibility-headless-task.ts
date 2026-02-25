/**
 * Accessibility Headless Task  –  SannaAccessibilityTask
 *
 * Registered via AppRegistry.registerHeadlessTask('SannaAccessibilityTask', …)
 * in index.js.
 *
 * Design principle: this task NEVER calls TTS directly.
 * All output (success and errors) is written to ConversationStore.appendPending().
 * The main app reads the pending queue when it returns to foreground and decides
 * whether to display a bubble and/or speak (driving mode only).
 *
 * Error formatting:
 * - Pre-provider errors (parse / config): raw message (no LLM available yet)
 * - All other errors: formulated by the LLM in the user's language and output style
 *
 * Flow:
 *   1.  Parse job parameters
 *   2.  Load agent config (API key, model, language, drivingMode)
 *   3.  Build LLM provider
 *   4.  Check Accessibility Service is enabled
 *   5.  Open the target app via Intent
 *   6.  Wait until the app is in foreground
 *   7.  Capture the accessibility tree
 *   8.  Run the LLM sub-agent loop
 *   9.  Reformulate the result via LLM (language-aware, mode-aware)
 *   10. Bring SannaBot back to foreground
 *   11. Append result to ConversationStore pending queue
 */
import { ClaudeProvider } from '../llm/claude-provider';
import { OpenAIProvider } from '../llm/openai-provider';
import type { LLMProvider } from '../llm/types';
import IntentModule from '../native/IntentModule';
import AccessibilityModule from '../native/AccessibilityModule';
import { runAccessibilitySubAgent } from './accessibility-sub-agent';
import SchedulerModule from '../native/SchedulerModule';
import { ConversationStore } from './conversation-store';
import { DebugLogger } from './debug-logger';
import { formulateResponse } from './system-prompt';

// ── Types ────────────────────────────────────────────────────────────────────

interface AccessibilityJob {
  packageName: string;
  goal: string;
  intentAction?: string | null;
  intentUri?: string | null;
}

interface AgentConfig {
  apiKey: string;
  provider: 'claude' | 'openai';
  model?: string;
  drivingMode?: boolean;
  language?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Bring SannaBot's Activity to the foreground. Non-fatal on failure. */
async function restoreSannaBot(): Promise<void> {
  try {
    await IntentModule.sendIntent('android.intent.action.MAIN', null, 'com.sannabot', null);
    await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
  } catch (err) {
    console.warn('[AccessibilityTask] Could not restore SannaBot to foreground:', err);
  }
}


/**
 * Formulate an error message via LLM, restore SannaBot, and write to the
 * pending queue.  Used for all error paths that already have a provider.
 */
async function failFormatted(
  rawMessage: string,
  ctx: {
    provider: LLMProvider;
    model: string;
    packageName: string;
    goal: string;
    drivingMode: boolean;
    language: string;
  },
): Promise<void> {
  const formulated = await formulateResponse({
    ...ctx,
    status: 'failed',
    rawMessage,
  });
  // Write BEFORE restoring foreground – the AppState active event fires as soon
  // as the app appears, so the message must already be in the queue by then.
  await ConversationStore.appendPending('assistant', formulated).catch(() => {});
  await restoreSannaBot();
}

// ── Main headless task ────────────────────────────────────────────────────────

export default async function accessibilityHeadlessTask(
  taskData: { jobJson: string },
): Promise<void> {
  console.log('[AccessibilityTask] Starting background UI automation');

  // 1. Parse job  (no provider yet → raw message on error)
  let job: AccessibilityJob;
  try {
    job = JSON.parse(taskData.jobJson) as AccessibilityJob;
  } catch {
    console.error('[AccessibilityTask] Failed to parse jobJson:', taskData.jobJson);
    await ConversationStore.appendPending('assistant', '❌ UI automation failed: Invalid job data.').catch(() => {}); // write before foreground restore
    await restoreSannaBot();
    return;
  }

  const { packageName, goal, intentAction, intentUri } = job;
  console.log(`[AccessibilityTask] Job: package=${packageName} goal="${goal}"`);

  // 2. Load agent config  (no provider yet → raw message on error)
  let config: AgentConfig;
  try {
    const configJson = await SchedulerModule.getAgentConfig();
    if (!configJson) throw new Error('No agent config found');
    config = JSON.parse(configJson) as AgentConfig;
    if (!config.apiKey) throw new Error('No API key configured');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AccessibilityTask] Config error:', msg);
    await ConversationStore.appendPending('assistant', `❌ UI automation failed: ${msg}`).catch(() => {}); // write before foreground restore
    await restoreSannaBot();
    return;
  }

  // 3. Build LLM provider  (all error paths below this point use failFormatted)
  const provider: LLMProvider = config.provider === 'claude'
    ? new ClaudeProvider(config.apiKey, config.model)
    : new OpenAIProvider(config.apiKey, config.model);

  const model = provider.getDefaultModel();
  const drivingMode = config.drivingMode ?? false;
  const language = config.language ?? 'en-US';

  // Shared context passed to failFormatted for every subsequent error
  const ctx = { provider, model, packageName, goal, drivingMode, language };

  // 4. Check Accessibility Service
  let serviceEnabled = false;
  try {
    serviceEnabled = await AccessibilityModule.isAccessibilityServiceEnabled();
  } catch { /* ignore */ }

  if (!serviceEnabled) {
    await failFormatted(
      'The Sanna Accessibility Service is not enabled. ' +
      'Please enable it in Android Settings → Accessibility.',
      ctx,
    );
    return;
  }

  // 5. Open app via Intent (if requested)
  if (intentAction) {
    try {
      await IntentModule.sendIntent(intentAction, intentUri ?? null, packageName, null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AccessibilityTask] Intent failed:', msg);
      await failFormatted(`Could not open the app: ${msg}`, ctx);
      return;
    }

    // 6. Wait for the app to appear in foreground (up to 10 seconds)
    let appVisible = false;
    try {
      appVisible = await AccessibilityModule.waitForApp(packageName, 10_000);
    } catch { /* ignore */ }

    if (!appVisible) {
      await failFormatted(
        `The app did not appear in the foreground within 10 seconds. ` +
        'Please make sure it is installed.',
        ctx,
      );
      return;
    }

    // Give the app time to render its UI
    await new Promise<void>(resolve => setTimeout(() => resolve(), 2500));
  }

  // 7. Capture accessibility tree
  let accessibilityTree: string;
  try {
    accessibilityTree = await AccessibilityModule.getAccessibilityTree();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AccessibilityTask] Tree capture failed:', msg);
    await failFormatted(`Could not read the UI tree: ${msg}`, ctx);
    return;
  }

  if (!accessibilityTree || accessibilityTree.includes('No active window found')) {
    await failFormatted('No active window found. The app does not seem to be open.', ctx);
    return;
  }

  // 8. Run LLM sub-agent
  console.log('[AccessibilityTask] Running sub-agent...');
  let subResult: { message: string; status: 'success' | 'failed' | 'timeout' };
  try {
    subResult = await runAccessibilitySubAgent({
      provider,
      model,
      packageName,
      goal,
      accessibilityTree,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AccessibilityTask] Sub-agent error:', msg);
    await failFormatted(`UI automation failed unexpectedly: ${msg}`, ctx);
    return;
  }

  console.log('[AccessibilityTask] Done:', subResult.status, subResult.message.slice(0, 200));

  // 9. Reformulate result via LLM (language-aware, mode-aware)
  const formulated = await formulateResponse({
    ...ctx,
    status: subResult.status,
    rawMessage: subResult.message,
  });

  // 10. Write to pending queue FIRST, then restore foreground.
  //     The AppState 'active' event fires the instant SannaBot appears – the
  //     message must already be in AsyncStorage before that happens, otherwise
  //     drainPending() will find nothing and the bubble won't show.
  await ConversationStore.appendPending('assistant', formulated).catch(() => {});
  await restoreSannaBot();
}

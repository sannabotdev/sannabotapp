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
 *   9.  Condense hints from the interaction (best-effort, non-fatal)
 *   10. Reformulate the result via LLM (language-aware, mode-aware)
 *   11. Bring SannaBot back to foreground
 *   12. Append result to ConversationStore pending queue
 */
import { ClaudeProvider } from '../llm/claude-provider';
import { OpenAIProvider } from '../llm/openai-provider';
import type { LLMProvider, Message } from '../llm/types';
import IntentModule from '../native/IntentModule';
import AccessibilityModule from '../native/AccessibilityModule';
import { runAccessibilitySubAgent } from './accessibility-sub-agent';
import SchedulerModule from '../native/SchedulerModule';
import { ConversationStore } from './conversation-store';
import { DebugLogger } from './debug-logger';
import { formulateResponse } from './system-prompt';
import { AccessibilityHintStore } from './accessibility-hint-store';
import { PersonalMemoryStore } from './personal-memory-store';

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
  /** Max iterations for the accessibility sub-agent (default: 12) */
  maxAccessibilityIterations?: number;
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

// ── Hint condensing ───────────────────────────────────────────────────────────

/**
 * Format the interaction message history into a readable string for the LLM condenser.
 *
 * Produces a chronological narrative:
 *   === Accessibility Tree ===
 *   === Action: click on node_5 ===
 *   === Result ===  (action result)
 *   === Accessibility Tree (Updated) ===
 *   ...
 */
function formatMessagesForCondensing(messages: Message[]): string {
  const parts: string[] = [];
  let treeIndex = 0;

  for (const msg of messages) {
    if (msg.role === 'user') {
      const label = treeIndex === 0 ? 'Accessibility Tree (Initial)' : 'Accessibility Tree (Updated)';
      treeIndex++;
      parts.push(`=== ${label} ===\n${msg.content}`);
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        if (tc.name === 'accessibility_action') {
          const action = tc.arguments.action as string;
          const nodeId = tc.arguments.node_id as string | undefined;
          const text = tc.arguments.text as string | undefined;
          let actionDesc = `=== Action: ${action}`;
          if (nodeId) { actionDesc += ` on ${nodeId}`; }
          if (text) { actionDesc += ` with text "${text}"`; }
          actionDesc += ' ===';
          parts.push(actionDesc);
        } else if (tc.name === 'get_accessibility_tree') {
          parts.push('=== Refreshing Accessibility Tree ===');
        } else if (tc.name === 'finish_task') {
          const tcStatus = tc.arguments.status as string;
          const tcMsg = tc.arguments.message as string | undefined;
          parts.push(`=== Finish Task: ${tcStatus}${tcMsg ? ` – ${tcMsg}` : ''} ===`);
        }
      }
    } else if (msg.role === 'tool') {
      parts.push(`=== Result ===\n${msg.content}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Condense the full interaction history into human-readable, app-specific hints.
 *
 * Uses the LLM to:
 * - Read the accessibility trees (which contain text/contentDesc labels)
 * - Describe the interaction flow in natural language (no node IDs)
 * - Merge with existing hints into 3–4 concise paragraphs
 *
 * Best-effort: failures are logged but do NOT abort the task.
 */
async function extractAndCondenseHints(
  messages: Message[],
  packageName: string,
  goal: string,
  status: 'success' | 'failed',
  provider: LLMProvider,
): Promise<void> {
  try {
    const fullMessageHistory = formatMessagesForCondensing(messages);

    // Load existing hints (empty string if none)
    const existingHints = await AccessibilityHintStore.getHints(packageName);

    const systemPrompt =
      `You are condensing accessibility interaction hints for the Android app "${packageName}". ` +
      `Your goal is to create compact, reusable hints that help future automation runs of the same app.`;

    const userPrompt =
      (existingHints ? `Existing hints:\n${existingHints}\n\n` : '') +
      `New experience from this run:\n` +
      `- Goal: ${goal}\n` +
      `- Status: ${status === 'success' ? '✅ SUCCESS – goal was achieved' : '❌ FAILED – goal was NOT achieved'}\n` +
      `- Full interaction history:\n${fullMessageHistory}\n\n` +
      `Analyze the complete interaction. The accessibility trees contain the full UI structure ` +
      `with labels (text attributes, contentDesc attributes).\n\n` +
      `Create a natural language description of the steps using button labels and UI element ` +
      `descriptions found in the accessibility trees.\n\n` +
      `IMPORTANT:\n` +
      `- Use the accessibility trees to identify which buttons/elements were interacted with ` +
      `(by their text, contentDesc, or other visible labels)\n` +
      `- DO NOT use node IDs (like "node_5") in your description\n` +
      `- Clearly mark SUCCESSFUL flows: "✅ To achieve X: navigate to home screen, then click 'Y'..."\n` +
      `- Clearly mark FAILED flows: "❌ Attempting X via Y did NOT work because..."\n` +
      `- Describe the flow in natural language using button labels and visible UI text\n` +
      `- Condense together with existing hints into 3-4 concise paragraphs\n` +
      `- Keep only the most important successful and failed flows\n` +
      `- Remove redundant or outdated information\n\n` +
      `Condensed hints:`;

    const condenseMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    DebugLogger.logLLMRequest(provider.getCurrentModel(), condenseMessages.length, 0, condenseMessages);

    const response = await provider.chat(condenseMessages, []);

    DebugLogger.logLLMResponse(response.content, [], response.usage, response);

    const condensedHints = response.content?.trim();
    if (condensedHints) {
      await AccessibilityHintStore.saveHints(packageName, condensedHints);
      DebugLogger.add('info', 'AccessibilityHints', `Condensed hints saved for ${packageName} (${condensedHints.length} chars)`, condensedHints);
      console.log(`[AccessibilityTask] Hints condensed and saved for ${packageName} (${condensedHints.length} chars)`);
    }
  } catch (err) {
    // Non-fatal – hint condensing is best-effort and must not abort the task
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[AccessibilityTask] Failed to condense hints:', msg);
    DebugLogger.add('error', 'AccessibilityHints', `Failed to condense hints for ${packageName}: ${msg}`);
  }
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
    await ConversationStore.appendPending('assistant', 'UI automation failed: Invalid job data.').catch(() => {}); // write before foreground restore
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
    await ConversationStore.appendPending('assistant', `UI automation failed: ${msg}`).catch(() => {}); // write before foreground restore
    await restoreSannaBot();
    return;
  }

  // 3. Build LLM provider  (all error paths below this point use failFormatted)
  const provider: LLMProvider = config.provider === 'claude'
    ? new ClaudeProvider(config.apiKey, config.model)
    : new OpenAIProvider(config.apiKey, config.model);

  const drivingMode = config.drivingMode ?? false;
  const language = config.language ?? 'en-US';

  // Shared context passed to failFormatted for every subsequent error
  const ctx = { provider, packageName, goal, drivingMode, language };

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

  // 5. Ensure foreground service is running before opening the target app
  // Give the system a moment to fully initialize the foreground service
  // This prevents Android from killing the task when SannaBot goes to background
  // The notification must be visible before we open the target app
  await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

  // 6. Open app via Intent
  // If intentAction is provided, use it. Otherwise, default to ACTION_MAIN to launch the app.
  const actionToUse = (intentAction && intentAction.trim() !== '')
    ? intentAction
    : 'android.intent.action.MAIN';
  console.log(`[AccessibilityTask] Opening app ${packageName} with action ${actionToUse}`);
  try {
    await IntentModule.sendIntent(actionToUse, intentUri ?? null, packageName, null);
    console.log(`[AccessibilityTask] Intent sent successfully`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AccessibilityTask] Intent failed:', msg);
    await failFormatted(`Could not open the app: ${msg}`, ctx);
    return;
  }

  // 7. Wait for the app to appear in foreground (up to 15 seconds)
  console.log(`[AccessibilityTask] Waiting for app ${packageName} to appear...`);
  let appVisible = false;
  try {
    appVisible = await AccessibilityModule.waitForApp(packageName, 15_000);
    console.log(`[AccessibilityTask] App visible: ${appVisible}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AccessibilityTask] waitForApp error:', msg);
  }

  if (!appVisible) {
    await failFormatted(
      `The app did not appear in the foreground within 15 seconds. ` +
      'Please make sure it is installed and try again.',
      ctx,
    );
    return;
  }

  // Give the app time to render its UI
  await new Promise<void>(resolve => setTimeout(() => resolve(), 2500));

  // 8. Capture accessibility tree
  let accessibilityTree: string;
  try {
    accessibilityTree = await AccessibilityModule.getAccessibilityTree();
    // Log the tree for debugging (truncated if too long)
    const treePreview = accessibilityTree.length > 2000
      ? accessibilityTree.slice(0, 2000) + '\n... (truncated)'
      : accessibilityTree;
    console.log('[AccessibilityTask] Captured accessibility tree:');
    console.log(treePreview);
    DebugLogger.add('info', 'AccessibilityTask', `Accessibility tree captured (${accessibilityTree.length} chars)`, accessibilityTree);
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

  // 9. Run LLM sub-agent
  console.log('[AccessibilityTask] Running sub-agent...');
  let subResult: { message: string; status: 'success' | 'failed' | 'timeout'; messages: Message[] };
  try {
    const personalMemory = await PersonalMemoryStore.getMemory();
    subResult = await runAccessibilitySubAgent({
      provider,
      packageName,
      goal,
      accessibilityTree,
      maxIterations: config.maxAccessibilityIterations,
      personalMemory,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AccessibilityTask] Sub-agent error:', msg);
    await failFormatted(`UI automation failed unexpectedly: ${msg}`, ctx);
    return;
  }

  console.log('[AccessibilityTask] Done:', subResult.status, subResult.message.slice(0, 200));

  // 10. Condense interaction into reusable hints (best-effort, skip on timeout)
  if (subResult.status !== 'timeout') {
    await extractAndCondenseHints(
      subResult.messages,
      packageName,
      goal,
      subResult.status,
      provider,
    );
  }

  // 11. Reformulate result via LLM (language-aware, mode-aware)
  const formulated = await formulateResponse({
    ...ctx,
    status: subResult.status,
    rawMessage: subResult.message,
  });

  // 12. Write to pending queue FIRST, then restore foreground.
  //     The AppState 'active' event fires the instant SannaBot appears – the
  //     message must already be in AsyncStorage before that happens, otherwise
  //     drainPending() will find nothing and the bubble won't show.
  await ConversationStore.appendPending('assistant', formulated).catch(() => {});
  await restoreSannaBot();
}

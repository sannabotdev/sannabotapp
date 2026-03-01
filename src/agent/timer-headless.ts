/**
 * Timer Headless Task – Background timer expiration message formatting
 *
 * Registered via AppRegistry.registerHeadlessTask in index.js.
 * When a timer expires, Android wakes up the JS runtime and runs this task.
 *
 * This module:
 *   1. Loads the timer from native storage
 *   2. Loads the agent config (API key, provider, language)
 *   3. Uses formulateResponse to format a user-friendly message via LLM
 *   4. Writes the message to the conversation
 */
import { formulateResponse } from './system-prompt';
import { ClaudeProvider } from '../llm/claude-provider';
import { OpenAIProvider } from '../llm/openai-provider';
import type { LLMProvider } from '../llm/types';
import { DebugLogger } from './debug-logger';
import { ConversationStore } from './conversation-store';
import TimerModule from '../native/TimerModule';
import SchedulerModule from '../native/SchedulerModule';
import IntentModule from '../native/IntentModule';

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  apiKey: string;
  provider: 'claude' | 'openai';
  model?: string;
  drivingMode?: boolean;
  language?: string;
}

interface Timer {
  id: string;
  label?: string;
  type: 'timer' | 'stopwatch';
  startTimeMs: number;
  durationMs?: number;
  enabled: boolean;
  createdAt: number;
}

const TAG = 'TimerHeadless';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Bring SannaBot's Activity to the foreground. Non-fatal on failure. */
async function restoreSannaBot(): Promise<void> {
  try {
    await IntentModule.sendIntent('android.intent.action.MAIN', null, 'com.sannabot', null);
    await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
  } catch (err) {
    DebugLogger.add('error', TAG, `Could not restore SannaBot to foreground: ${err}`);
  }
}

// ── Main headless task ────────────────────────────────────────────────────────

export default async function timerHeadlessTask(
  taskData: { timerId: string },
): Promise<void> {
  const { timerId } = taskData;
  DebugLogger.add('info', TAG, `⏰ Timer expired: ${timerId}`);

  // These are set progressively – used in the catch block for LLM error formatting
  let provider: LLMProvider | null = null;
  let lang = 'en-US';
  let drivingMode = false;
  let timerLabel = '';

  try {
    // 1. Load the timer
    const timerJson = await TimerModule.getTimer(timerId);
    if (!timerJson) {
      DebugLogger.add('error', TAG, `Timer ${timerId} not found`);
      // Timer already removed or doesn't exist - nothing to do
      return;
    }
    const timer: Timer = JSON.parse(timerJson);
    timerLabel = timer.label || 'Timer';

    if (!timer.enabled) {
      DebugLogger.add('info', TAG, `Timer ${timerId} is disabled, skipping`);
      // Remove disabled timer
      await TimerModule.removeTimer(timerId).catch(() => {});
      return;
    }

    DebugLogger.add('info', TAG, `Timer loaded: "${timerLabel}"`, JSON.stringify(timer, null, 2));

    // 2. Load agent config (use SchedulerModule's config - same storage)
    const configJson = await SchedulerModule.getAgentConfig();
    if (!configJson) {
      DebugLogger.add('error', TAG, 'No agent config found – cannot format message');
      // Fallback: write simple message
      await ConversationStore.appendPending(
        'assistant',
        `Timer "${timerLabel}" has finished.`,
      ).catch(() => {});
      // Remove timer
      await TimerModule.removeTimer(timerId).catch(() => {});
      return;
    }
    const config: AgentConfig = JSON.parse(configJson);

    lang = config.language || 'en-US';
    drivingMode = config.drivingMode ?? false;

    if (!config.apiKey) {
      DebugLogger.add('error', TAG, 'No API key in agent config');
      // Fallback: write simple message
      await ConversationStore.appendPending(
        'assistant',
        `Timer "${timerLabel}" has finished.`,
      ).catch(() => {});
      // Remove timer
      await TimerModule.removeTimer(timerId).catch(() => {});
      return;
    }

    // 3. Create LLM provider
    provider =
      config.provider === 'claude'
        ? new ClaudeProvider(config.apiKey, config.model)
        : new OpenAIProvider(config.apiKey, config.model);

    DebugLogger.add('info', TAG, `Provider: ${config.provider} (${config.model || 'default'})`);

    // 4. Format message via LLM using formulateResponse
    const rawMessage = `Timer "${timerLabel}" has finished.`;
    const formulated = await formulateResponse({
      provider,
      packageName: 'com.sannabot',
      goal: `Timer "${timerLabel}" expired`,
      status: 'success',
      rawMessage,
      drivingMode,
      language: lang,
    });

    // 5. Write to pending queue FIRST, then restore foreground.
    //     The AppState 'active' event fires the instant SannaBot appears – the
    //     message must already be in AsyncStorage before that happens, otherwise
    //     drainPending() will find nothing and the bubble won't show.
    await ConversationStore.appendPending('assistant', formulated).catch(() => {});
    DebugLogger.add('info', TAG, `✅ Timer message formatted and written to conversation`);

    // 6. Remove timer from storage (after message is formatted)
    await TimerModule.removeTimer(timerId).catch(() => {});

    // 7. Bring app to foreground so user sees the message
    await restoreSannaBot();

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    DebugLogger.add('error', TAG, `Timer headless task failed: ${errMsg}`, err instanceof Error ? err.stack : undefined);

    // Fallback: write simple message if LLM formatting failed
    try {
      await ConversationStore.appendPending(
        'assistant',
        `Timer "${timerLabel || 'Timer'}" has finished.`,
      ).catch(() => {});
      // Remove timer even on error
      if (taskData.timerId) {
        await TimerModule.removeTimer(taskData.timerId).catch(() => {});
      }
    } catch {
      // Non-fatal
    }
  }
}

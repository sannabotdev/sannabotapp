/**
 * Scheduler Headless Task – Background sub-agent execution
 *
 * Registered via AppRegistry.registerHeadlessTask in index.js.
 * When an alarm fires, Android wakes up the JS runtime and runs this task.
 *
 * This module:
 *   1. Loads the schedule from native storage
 *   2. Loads the agent config (API key, provider, enabled skills)
 *   3. Creates a mini ConversationPipeline (same tools as the main app)
 *   4. Executes the stored instruction through the LLM
 *   5. Handles recurrence: calculates next trigger or cleans up one-time schedules
 *   6. Shows a notification with the execution result
 */
import { SkillLoader, registerSkillContent } from './skill-loader';
import { createToolRegistry } from './create-tool-registry';
import { runToolLoop } from './tool-loop';
import { buildSystemPrompt, formulateError } from './system-prompt';
import { ClaudeProvider } from '../llm/claude-provider';
import { OpenAIProvider } from '../llm/openai-provider';
import type { LLMProvider, Message } from '../llm/types';
import { DebugLogger } from './debug-logger';
import { ConversationStore } from './conversation-store';
import { PersonalMemoryStore } from './personal-memory-store';

// Credential infrastructure
import { TokenStore } from '../permissions/token-store';
import { CredentialManager } from '../permissions/credential-manager';
import { GoogleAuth } from '../permissions/google-auth';

// Scheduler
import SchedulerModule from '../native/SchedulerModule';
import { calculateNextTrigger } from '../tools/scheduler-tool';
import type { Schedule } from '../tools/scheduler-tool';

// Intent – for bringing SannaBot back to the foreground after a result is ready
import IntentModule from '../native/IntentModule';

// Skills – imported at bundle time (metro md-transformer)
import googleMapsSkill from '../../assets/skills/google-maps/SKILL.md';
import phoneSkill from '../../assets/skills/phone/SKILL.md';
import smsSkill from '../../assets/skills/sms/SKILL.md';
import gmailSkill from '../../assets/skills/gmail/SKILL.md';
import spotifySkill from '../../assets/skills/spotify/SKILL.md';
import contactsSkill from '../../assets/skills/contacts/SKILL.md';
import calendarSkill from '../../assets/skills/calendar/SKILL.md';
import googleTasksSkill from '../../assets/skills/google-tasks/SKILL.md';
import schedulerSkill from '../../assets/skills/scheduler/SKILL.md';
import whatsappSkill from '../../assets/skills/whatsapp/SKILL.md';
import listsSkill from '../../assets/skills/lists/SKILL.md';

// Register all skill content
registerSkillContent('google-maps', googleMapsSkill);
registerSkillContent('phone', phoneSkill);
registerSkillContent('sms', smsSkill);
registerSkillContent('gmail', gmailSkill);
registerSkillContent('spotify', spotifySkill);
registerSkillContent('contacts', contactsSkill);
registerSkillContent('calendar', calendarSkill);
registerSkillContent('google-tasks', googleTasksSkill);
registerSkillContent('scheduler', schedulerSkill);
registerSkillContent('whatsapp', whatsappSkill);
registerSkillContent('lists', listsSkill);

// ── Agent Config (persisted by App.tsx) ──────────────────────────────────

interface AgentConfig {
  apiKey: string;
  provider: 'claude' | 'openai';
  model?: string;
  enabledSkillNames: string[];
  googleWebClientId?: string;
  drivingMode?: boolean;
  /** BCP-47 language tag, e.g. 'de-AT', 'en-US'. Falls back to 'en-US'. */
  language?: string;
  /** Max iterations for scheduler sub-agents (default: 8) */
  maxSubAgentIterations?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const TAG = 'Scheduler';

/** Bring SannaBot's Activity to the foreground. Non-fatal on failure. */
async function bringToForeground(): Promise<void> {
  try {
    await IntentModule.sendIntent('android.intent.action.MAIN', null, 'com.sannabot', null);
  } catch (err) {
    DebugLogger.add('error', TAG, `Could not bring app to foreground: ${err}`);
  }
}


// ── Main headless task ───────────────────────────────────────────────────

export default async function schedulerHeadlessTask(
  taskData: { scheduleId: string },
): Promise<void> {
  const { scheduleId } = taskData;
  DebugLogger.add('info', TAG, `⏰ Executing schedule: ${scheduleId}`);

  // These are set progressively – used in the catch block for LLM error formatting
  let provider: LLMProvider | null = null;
  let model = '';
  let lang = 'en-US';
  let drivingMode = false;
  let instruction = '';

  try {
    // 1. Load the schedule
    const scheduleJson = await SchedulerModule.getSchedule(scheduleId);
    if (!scheduleJson) {
      DebugLogger.add('error', TAG, `Schedule ${scheduleId} not found`);
      return;
    }
    const schedule: Schedule = JSON.parse(scheduleJson);
    instruction = schedule.instruction;

    if (!schedule.enabled) {
      DebugLogger.add('info', TAG, `Schedule ${scheduleId} is disabled, skipping`);
      return;
    }

    DebugLogger.add('info', TAG, `Schedule loaded: "${instruction}"`, JSON.stringify(schedule, null, 2));

    // 2. Load agent config
    const configJson = await SchedulerModule.getAgentConfig();
    if (!configJson) {
      DebugLogger.add('error', TAG, 'No agent config found – cannot run sub-agent');
      await ConversationStore.appendPending('assistant', 'Scheduled task could not run: No API key configured.').catch(() => {});
      return;
    }
    const config: AgentConfig = JSON.parse(configJson);

    lang = config.language || 'en-US';
    drivingMode = config.drivingMode ?? false;

    if (!config.apiKey) {
      DebugLogger.add('error', TAG, 'No API key in agent config');
      await ConversationStore.appendPending('assistant', 'Scheduled task could not run: No API key.').catch(() => {});
      return;
    }

    // 3. Create LLM provider
    provider = config.provider === 'claude'
      ? new ClaudeProvider(config.apiKey, config.model)
      : new OpenAIProvider(config.apiKey, config.model);

    model = provider.getCurrentModel();
    DebugLogger.add('info', TAG, `Provider: ${config.provider} (${model})`);

    // 4. Create tool registry (same tools as main app, minus scheduler to prevent recursion)
    const tokenStore = new TokenStore();
    // Headless tasks can't show a biometric prompt, but the Keychain entries
    // themselves are NOT biometric-protected – only the vault gate entry is.
    // So we skip the interactive unlock for background execution.
    tokenStore.unlockForHeadless();

    const credentialManager = new CredentialManager(tokenStore);

    // Set up Google token auto-refresh via the Sign-In SDK
    if (config.googleWebClientId) {
      const googleAuth = new GoogleAuth(credentialManager);
      googleAuth.configure(config.googleWebClientId);
      // Only register the refresh handler (not the setup handler – no UI in headless)
      credentialManager.registerTokenRefreshHandler(
        'google',
        () => googleAuth.getAccessToken(),
      );
    }

    const skillLoader = new SkillLoader();

    const toolRegistry = await createToolRegistry({
      credentialManager,
      skillLoader,
      includeTts: false, // result is passed to foreground via appendPending; no TTS in background
      includeScheduler: false, // prevent recursive schedule creation
      includePersonalMemoryTool: false,
    });
    toolRegistry.removeDisabledSkillTools(skillLoader, config.enabledSkillNames);

    const personalMemory = await PersonalMemoryStore.getMemory();

    // 5. Build system prompt
    const systemPrompt = buildSystemPrompt({
      skillLoader,
      toolRegistry,
      enabledSkillNames: config.enabledSkillNames,
      drivingMode,
      language: lang,
      personalMemory,
    });

    // 6. Build the instruction with context
    const now = new Date();
    const timeStr = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });

    const userInstruction = [
      `[SCHEDULED TASK – Automatic execution at ${timeStr}, ${dateStr}]`,
      ``,
      `Execute the following instruction: ${instruction}`,
      ``,
      `IMPORTANT: You are a background agent. There is no direct user interaction.`,
      `- Execute the task directly without asking for clarification.`,
      `- Do NOT use any speech or TTS. Return your result as text only.`,
    ].join('\n');

    // 7. Run the sub-agent
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInstruction },
    ];

    DebugLogger.add('info', TAG, `Running sub-agent for: "${instruction}"`);

    const result = await runToolLoop(
      {
        provider,
        tools: toolRegistry,
        maxIterations: config.maxSubAgentIterations ?? 8,
      },
      messages,
    );

    DebugLogger.add('info', TAG, `✅ Sub-agent done (${result.iterations} iterations)`, result.content);

    // Write the assistant result to the pending queue so it appears as a bubble,
    // then bring the app to the foreground so the user sees it immediately.
    // ALWAYS write something, even if content is empty (e.g., max iterations reached)
    let messageToShow = result.content;
    
    // If content is empty (max iterations reached), format it via LLM for consistency
    if (!messageToShow) {
      const rawError = `Scheduled task reached iteration limit (${result.iterations} iterations) and could not be completed.`;
      messageToShow = await formulateError({
        provider,
        instruction: instruction,
        rawError,
        drivingMode,
        language: lang,
      });
    }
    
    await ConversationStore.appendPending('assistant', messageToShow).catch(() => {});
    await bringToForeground();

    // 8. Mark as executed
    await SchedulerModule.markExecuted(scheduleId);

    // 9. Handle recurrence
    const nextTrigger = calculateNextTrigger(schedule);
    if (nextTrigger !== null) {
      // Recurring: set next trigger
      await SchedulerModule.updateTrigger(scheduleId, nextTrigger);
      DebugLogger.add('info', TAG, `Next execution at ${new Date(nextTrigger).toISOString()}`);
    } else {
      // One-time: remove the schedule
      await SchedulerModule.removeSchedule(scheduleId);
      DebugLogger.add('info', TAG, `One-time schedule ${scheduleId} removed`);
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    DebugLogger.add('error', TAG, `Schedule ${scheduleId} failed: ${errMsg}`);

    // If we have a provider, ask the LLM to formulate a user-friendly error
    if (provider) {
      const userMessage = await formulateError({
        provider,
        instruction: instruction || scheduleId,
        rawError: errMsg,
        drivingMode,
        language: lang,
      });
      await ConversationStore.appendPending('assistant', userMessage).catch(() => {});
    } else {
      // No provider available (config/key error) – write raw error to pending
      await ConversationStore.appendPending('assistant', `Scheduled task failed: ${errMsg}`).catch(() => {});
    }
    // Bring app to foreground so user sees the error result
    await bringToForeground();
  }
}

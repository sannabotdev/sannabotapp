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
import { SILENT_REPLY_TOKEN } from './tokens';
import { createLLMProvider } from '../llm/llm-registry';
import type { LLMProvider, Message } from '../llm/types';
import { DebugLogger } from './debug-logger';
import { DebugFileLogger } from './debug-file-logger';
import { ConversationStore } from './conversation-store';
import { PersonalMemoryStore } from './personal-memory-store';
import { addEntry } from './journal-store';

// Credential infrastructure
import { TokenStore } from '../permissions/token-store';
import { CredentialManager } from '../permissions/credential-manager';


// Scheduler
import SchedulerModule from '../native/SchedulerModule';
import { calculateNextTrigger } from '../tools/scheduler-tool';
import type { Schedule } from '../tools/scheduler-tool';

// Foreground restore
import { bringToForeground } from './bring-to-foreground';

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


// ── Main headless task ───────────────────────────────────────────────────

export default async function schedulerHeadlessTask(
  taskData: { scheduleId: string },
): Promise<void> {
  const { scheduleId } = taskData;
  DebugFileLogger.writeSystemLog('LIFECYCLE', `▶ SannaSchedulerTask started (id=${scheduleId})`);
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

    // Check if scheduler skill is enabled
    if (!config.enabledSkillNames.includes('scheduler')) {
      DebugLogger.add('info', TAG, 'Scheduler skill is disabled – skipping execution');
      return;
    }

    lang = config.language || 'en-US';
    drivingMode = config.drivingMode ?? false;

    if (!config.apiKey) {
      DebugLogger.add('error', TAG, 'No API key in agent config');
      await ConversationStore.appendPending('assistant', 'Scheduled task could not run: No API key.').catch(() => {});
      return;
    }

    // 3. Create LLM provider
    provider = createLLMProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model || '',
    });

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
      credentialManager.configureGoogleTokenRefresh(config.googleWebClientId);
    }

    const skillLoader = new SkillLoader();

    const toolRegistry = await createToolRegistry({
      credentialManager,
      skillLoader,
      includeTts: true, // TTS available, but only use if explicitly requested by user
      includeScheduler: true, // included so the sub-agent can disable/delete its own schedule
      includeAccessibility: false, // accessibility tool only for main agent
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
      `Schedule ID: ${scheduleId}`,
      `You can use the scheduler tool with this ID to disable (action: "disable") or delete (action: "delete") this schedule after execution if needed (e.g. for one-shot tasks that should not recur, or if the task is complete).`,
      ``,
      `Execute the following instruction: ${instruction}`,
      ``,
      `IMPORTANT: You are a background agent. There is no direct user interaction.`,
      `- Execute the task directly without asking for clarification.`,
      `- Do NOT use TTS (text-to-speech) unless the user explicitly requests it in the instruction (e.g., "speak", "say aloud", "read out", "announce").`,
      `- Return your result as text only unless speech is explicitly requested.`,
      `- Only describe actions that have been fully executed. Use past tense when reporting completed actions. Never describe planned actions as if they are already done.`,
      `- If the task is conditional and the condition is NOT met, respond with EXACTLY: ${SILENT_REPLY_TOKEN} (no other text). Example: "If it rains tomorrow, remind me to bring an umbrella" → weather check shows no rain → respond ${SILENT_REPLY_TOKEN}.`,
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

    // Silent reply: sub-agent decided the result is not user-facing (e.g., conditional task where condition was false)
    if (result.content?.includes(SILENT_REPLY_TOKEN)) {
      DebugLogger.add('info', TAG, `Silent reply for "${instruction}" – no bubble shown`);
      // Still mark as executed and handle recurrence (below), but skip UI output
    } else {
      // Write the assistant result to the pending queue so it appears as a bubble,
      // then bring the app to the foreground so the user sees it immediately.
      // ALWAYS write something, even if content is empty (e.g., max iterations reached)
      let messageToShow = result.content;
      const isMaxIterationsReached = result.iterations >= (config.maxSubAgentIterations ?? 8);

      // If content is empty or max iterations reached, format it via LLM for consistency
      if (!messageToShow || isMaxIterationsReached) {
        const rawError = isMaxIterationsReached
          ? `Scheduled task reached iteration limit (${result.iterations} iterations) and could not be completed. You can increase the iteration limit in Settings → Agent Iterations → Sub-Agent (App Rules & Scheduler).`
          : `Scheduled task completed but no output was generated.`;
        messageToShow = await formulateError({
          provider,
          instruction: instruction,
          rawError,
          drivingMode,
          language: lang,
        });
      }

      await ConversationStore.appendPending('assistant', messageToShow).catch(() => {});
      await bringToForeground(TAG);

      // 8. Create journal entry (always, even on errors/max iterations)
      try {
        await addEntry({
          category: 'Scheduler',
          title: instruction,
          details: messageToShow,
        });
      } catch (err) {
        // Non-fatal: journal entry creation failed
        DebugLogger.add('error', TAG, `Failed to create journal entry: ${err}`);
      }
    }

    // 9. Mark as executed
    await SchedulerModule.markExecuted(scheduleId);

    // 10. Handle recurrence
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

    DebugFileLogger.writeSystemLog('LIFECYCLE', `✅ SannaSchedulerTask finished (id=${scheduleId})`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    DebugFileLogger.writeSystemLog('LIFECYCLE', `❌ SannaSchedulerTask crashed (id=${scheduleId}): ${errMsg}`);
    DebugLogger.add('error', TAG, `Schedule ${scheduleId} failed: ${errMsg}`);

    // If we have a provider, ask the LLM to formulate a user-friendly error
    let userMessage: string;
    if (provider) {
      userMessage = await formulateError({
        provider,
        instruction: instruction || scheduleId,
        rawError: errMsg,
        drivingMode,
        language: lang,
      });
    } else {
      // No provider available (config/key error) – write raw error to pending
      userMessage = `Scheduled task failed: ${errMsg}`;
    }
    await ConversationStore.appendPending('assistant', userMessage).catch(() => {});
    
    // Create journal entry for error case
    try {
      await addEntry({
        category: 'Scheduler',
        title: instruction || scheduleId,
        details: userMessage,
      });
    } catch (journalErr) {
      // Non-fatal: journal entry creation failed
      DebugLogger.add('error', TAG, `Failed to create journal entry: ${journalErr}`);
    }
    
    // Bring app to foreground so user sees the error result
    await bringToForeground(TAG);
  }
}

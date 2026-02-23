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
import { NativeModules } from 'react-native';
import { SkillLoader, registerSkillContent } from './skill-loader';
import { ToolRegistry } from './tool-registry';
import { runToolLoop } from './tool-loop';
import { buildSystemPrompt } from './system-prompt';
import { ClaudeProvider } from '../llm/claude-provider';
import { OpenAIProvider } from '../llm/openai-provider';
import type { LLMProvider, Message } from '../llm/types';

// Tools
import { IntentTool } from '../tools/intent-tool';
import { TTSTool } from '../tools/tts-tool';
import { HttpTool } from '../tools/http-tool';
import { QueryTool } from '../tools/query-tool';
import { DeviceTool } from '../tools/device-tool';
import { SmsTool } from '../tools/sms-tool';

// Credential infrastructure
import { TokenStore } from '../permissions/token-store';
import { CredentialManager } from '../permissions/credential-manager';
import { GoogleAuth } from '../permissions/google-auth';

// Scheduler
import SchedulerModule from '../native/SchedulerModule';
import { calculateNextTrigger } from '../tools/scheduler-tool';
import type { Schedule } from '../tools/scheduler-tool';

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

// ── Agent Config (persisted by App.tsx) ──────────────────────────────────

interface AgentConfig {
  apiKey: string;
  provider: 'claude' | 'openai';
  model?: string;
  enabledSkillNames: string[];
  googleWebClientId?: string;
}

// ── Notification helper ──────────────────────────────────────────────────

/**
 * Show a native notification. We use the TTSModule for speech and
 * fall back to console.log if native notification module isn't available.
 */
async function showNotification(title: string, body: string): Promise<void> {
  // Use the DeviceQueryModule's notification helper if available,
  // otherwise just log. The TTS will handle the audio alert.
  console.log(`[SchedulerHeadless] ${title}: ${body}`);
}

async function speakResult(text: string): Promise<void> {
  try {
    const { TTSModule } = NativeModules;
    if (TTSModule) {
      await TTSModule.speak(text, 'en-US', `sched_${Date.now()}`);
    }
  } catch (err) {
    console.warn('[SchedulerHeadless] TTS failed:', err);
  }
}

// ── Main headless task ───────────────────────────────────────────────────

export default async function schedulerHeadlessTask(
  taskData: { scheduleId: string },
): Promise<void> {
  const { scheduleId } = taskData;
  console.log(`[SchedulerHeadless] Executing schedule: ${scheduleId}`);

  try {
    // 1. Load the schedule
    const scheduleJson = await SchedulerModule.getSchedule(scheduleId);
    if (!scheduleJson) {
      console.warn(`[SchedulerHeadless] Schedule ${scheduleId} not found`);
      return;
    }
    const schedule: Schedule = JSON.parse(scheduleJson);

    if (!schedule.enabled) {
      console.log(`[SchedulerHeadless] Schedule ${scheduleId} is disabled, skipping`);
      return;
    }

    // 2. Load agent config
    const configJson = await SchedulerModule.getAgentConfig();
    if (!configJson) {
      console.error('[SchedulerHeadless] No agent config found – cannot run sub-agent');
      await speakResult('Scheduled task could not be executed: No API key configured.');
      return;
    }
    const config: AgentConfig = JSON.parse(configJson);

    if (!config.apiKey) {
      console.error('[SchedulerHeadless] No API key in agent config');
      await speakResult('Scheduled task could not be executed: No API key.');
      return;
    }

    // 3. Create LLM provider
    const provider: LLMProvider = config.provider === 'claude'
      ? new ClaudeProvider(config.apiKey, config.model)
      : new OpenAIProvider(config.apiKey, config.model);

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

    const toolRegistry = new ToolRegistry();
    toolRegistry.register(new IntentTool());
    toolRegistry.register(new TTSTool());
    toolRegistry.register(new HttpTool(credentialManager));
    toolRegistry.register(new QueryTool());
    toolRegistry.register(new DeviceTool());
    toolRegistry.register(new SmsTool());
    // NOTE: We intentionally do NOT register SchedulerTool here
    // to prevent the sub-agent from creating recursive schedules.

    // 5. Build system prompt
    const skillLoader = new SkillLoader();
    const systemPrompt = buildSystemPrompt({
      skillLoader,
      toolRegistry,
      enabledSkillNames: config.enabledSkillNames,
      drivingMode: false,
    });

    // 6. Build the instruction with context
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

    const userInstruction = [
      `[SCHEDULED TASK – Automatic execution at ${timeStr}, ${dateStr}]`,
      ``,
      `Execute the following instruction: ${schedule.instruction}`,
      ``,
      `IMPORTANT: You are a background agent. There is no direct user interaction.`,
      `- Execute the task directly without asking for clarification.`,
      `- Use the tts tool to inform the user about the result.`,
      `- On errors: Use the tts tool to report the error.`,
    ].join('\n');

    // 7. Run the sub-agent
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInstruction },
    ];

    console.log(`[SchedulerHeadless] Running sub-agent for: "${schedule.instruction}"`);

    const result = await runToolLoop(
      {
        provider,
        model: provider.getDefaultModel(),
        tools: toolRegistry,
        maxIterations: 8,
      },
      messages,
    );

    console.log(`[SchedulerHeadless] Sub-agent completed in ${result.iterations} iterations`);
    console.log(`[SchedulerHeadless] Result: ${result.content.slice(0, 200)}`);

    // 8. Mark as executed
    await SchedulerModule.markExecuted(scheduleId);

    // 9. Handle recurrence
    const nextTrigger = calculateNextTrigger(schedule);
    if (nextTrigger !== null) {
      // Recurring: set next trigger
      await SchedulerModule.updateTrigger(scheduleId, nextTrigger);
      console.log(`[SchedulerHeadless] Next execution at ${new Date(nextTrigger).toISOString()}`);
    } else {
      // One-time: remove the schedule
      await SchedulerModule.removeSchedule(scheduleId);
      console.log(`[SchedulerHeadless] One-time schedule ${scheduleId} removed`);
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[SchedulerHeadless] Error executing schedule ${scheduleId}:`, errMsg);
    await speakResult(`Scheduled task failed: ${errMsg}`);
  }
}

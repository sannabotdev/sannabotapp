/**
 * Notification Headless Task – Background sub-agent execution for notifications
 *
 * Registered via AppRegistry.registerHeadlessTask in index.js.
 * Started directly by SannaNotificationListenerService (native Android) when a
 * notification from a subscribed app arrives – bypasses the React Native foreground
 * thread entirely.
 *
 * This module:
 *   1. Parses the incoming notification data
 *   2. Loads agent config (API key, provider, enabled skills) from native storage
 *   3. Loads notification rules from AsyncStorage
 *   4. Checks if any rules apply to this notification's app
 *   5. Runs the full notification sub-agent (evaluates conditions, executes matching rule)
 *   6. Writes the final result to ConversationStore pending queue
 *   7. Brings SannaBot back to the foreground – the app then speaks the result via drainPending
 */
import { SkillLoader, registerSkillContent } from './skill-loader';
import { runNotificationSubAgent } from './notification-sub-agent';
import type { NotificationPayload } from './notification-sub-agent';
import { ClaudeProvider } from '../llm/claude-provider';
import { OpenAIProvider } from '../llm/openai-provider';
import type { LLMProvider } from '../llm/types';
import { DebugLogger } from './debug-logger';
import { ConversationStore } from './conversation-store';
import { loadRules, getRulesForApp } from './notification-rules-store';
import type { NotificationRule } from './notification-rules-store';
import IntentModule from '../native/IntentModule';

// Credential infrastructure
import { TokenStore } from '../permissions/token-store';
import { CredentialManager } from '../permissions/credential-manager';
import { GoogleAuth } from '../permissions/google-auth';

// Agent config – reuse SchedulerModule (same config as all headless tasks)
import SchedulerModule from '../native/SchedulerModule';

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
import notificationsSkill from '../../assets/skills/notifications/SKILL.md';
import weatherSkill from '../../assets/skills/weather/SKILL.md';
import slackSkill from '../../assets/skills/slack/SKILL.md';

// Register all skill content so SkillLoader can build the system prompt in headless context
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
registerSkillContent('notifications', notificationsSkill);
registerSkillContent('weather', weatherSkill);
registerSkillContent('slack', slackSkill);

// ── Config & constants ────────────────────────────────────────────────────────

const TAG = 'NotifHeadless';

interface AgentConfig {
  apiKey: string;
  provider: 'claude' | 'openai';
  model?: string;
  enabledSkillNames: string[];
  googleWebClientId?: string;
  drivingMode?: boolean;
  /** BCP-47 language tag, e.g. 'de-AT', 'en-US'. Falls back to 'en-US'. */
  language?: string;
}

/** Maps Android package names to human-readable app names. */
const APP_ALIAS_MAP: Record<string, string> = {
  'com.whatsapp': 'WhatsApp',
  'com.google.android.gm': 'Email',
  'org.telegram.messenger': 'Telegram',
  'org.thoughtcrime.securesms': 'Signal',
  'com.android.mms': 'SMS',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Bring SannaBot's Activity to the foreground. Non-fatal on failure. */
async function bringToForeground(): Promise<void> {
  try {
    await IntentModule.sendIntent('android.intent.action.MAIN', null, 'com.sannabot', null);
  } catch (err) {
    DebugLogger.add('error', TAG, `Could not bring app to foreground: ${err}`);
  }
}

// ── Main headless task ────────────────────────────────────────────────────────

export default async function notificationHeadlessTask(
  taskData: { notificationJson: string },
): Promise<void> {
  DebugLogger.add('info', TAG, '▶ Notification headless task started');

  // 1. Parse notification data
  let notifData: {
    packageName: string;
    title: string;
    text: string;
    sender: string;
    timestamp: number;
    key: string;
  };

  try {
    notifData = JSON.parse(taskData.notificationJson);
  } catch (err) {
    DebugLogger.add('error', TAG, `Failed to parse notification JSON: ${err}`);
    return;
  }

  const { packageName, title, text, sender } = notifData;

  // Detailed logging – mirrors what App.tsx previously logged on the foreground thread
  DebugLogger.add(
    'info',
    TAG,
    `${packageName}: "${title}"`,
    [
      `packageName: ${packageName}`,
      `title: ${title}`,
      `text: ${text}`,
      `sender: ${sender}`,
      `timestamp: ${notifData.timestamp}`,
      `key: ${notifData.key}`,
    ].join('\n'),
  );

  // 2. Load agent config
  const configJson = await SchedulerModule.getAgentConfig();
  if (!configJson) {
    DebugLogger.add('error', TAG, 'No agent config found – cannot run sub-agent');
    return;
  }

  const config: AgentConfig = JSON.parse(configJson);
  const lang = config.language || 'en-US';
  const drivingMode = config.drivingMode ?? false;

  if (!config.apiKey) {
    DebugLogger.add('error', TAG, 'No API key in agent config');
    return;
  }

  // 3. Build LLM provider
  const provider: LLMProvider = config.provider === 'claude'
    ? new ClaudeProvider(config.apiKey, config.model)
    : new OpenAIProvider(config.apiKey, config.model);

  DebugLogger.add('info', TAG, `Provider: ${config.provider} (${provider.getDefaultModel()})`);

  // 4. Load rules from AsyncStorage and filter for this app
  let rules: NotificationRule[] = [];
  try {
    const allRules = await loadRules();
    rules = getRulesForApp(allRules, packageName);
  } catch (err) {
    DebugLogger.add('error', TAG, `Failed to load rules: ${err}`);
    return;
  }

  if (rules.length === 0) {
    DebugLogger.add('info', TAG, `No enabled rules for ${packageName} – skipping`);
    return;
  }

  DebugLogger.add(
    'info',
    TAG,
    `${rules.length} rule(s) for ${packageName}`,
    rules.map(r => `[${r.id}] ${r.condition || '(catch-all)'} → ${r.instruction}`).join('\n'),
  );

  // 5. Map package name to display name and build payload
  const appName = APP_ALIAS_MAP[packageName] || packageName;
  const isEmail = appName === 'Email' || appName === 'Gmail';

  const payload: NotificationPayload = {
    appName,
    sender: sender || title || '',
    subject: isEmail ? (text || '') : '',
    preview: isEmail ? '' : (text || ''),
    packageName,
  };

  // 6. Set up credential manager (headless unlock – no biometric prompt)
  const tokenStore = new TokenStore();
  tokenStore.unlockForHeadless();
  const credentialManager = new CredentialManager(tokenStore);

  if (config.googleWebClientId) {
    const googleAuth = new GoogleAuth(credentialManager);
    googleAuth.configure(config.googleWebClientId);
    credentialManager.registerTokenRefreshHandler(
      'google',
      () => googleAuth.getAccessToken(),
    );
  }

  // 7. Run notification sub-agent
  try {
    DebugLogger.add('info', TAG, `Running sub-agent for: "${appName} – ${payload.sender}"`);

    const resultText = await runNotificationSubAgent(
      {
        provider,
        credentialManager,
        enabledSkillNames: config.enabledSkillNames,
        drivingMode,
        language: lang,
      },
      payload,
      rules,
    );

    if (resultText && !resultText.includes('__NO_MATCH__')) {
      // 8. Write result to pending queue first, then restore foreground.
      //    (appendPending must complete before bringToForeground so drainPending
      //    finds the message when AppState fires 'active')
      await ConversationStore.appendPending('assistant', resultText).catch(() => {});
      DebugLogger.add('info', TAG, `✅ Sub-agent done, result written to pending queue`);

      // 9. Bring app to foreground – drainPending() will display + speak the result
      await bringToForeground();
    } else {
      DebugLogger.add('info', TAG, `No condition matched for "${packageName}" – no bubble shown`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    DebugLogger.add('error', TAG, `Sub-agent failed: ${errMsg}`);
    await ConversationStore.appendPending('assistant', `❌ Notification verarbeitung fehlgeschlagen: ${errMsg}`).catch(() => {});
    await bringToForeground();
  }
}

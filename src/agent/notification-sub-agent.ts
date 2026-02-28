/**
 * Notification Sub-Agent – Independent agent for processing incoming notifications
 *
 * Each notification gets its own sub-agent with a dedicated tool loop,
 * independent from the main ConversationPipeline. This means:
 *   - The main pipeline stays free for user interaction
 *   - Multiple notifications are queued and processed sequentially
 *   - The LLM evaluates which rule(s) match the notification based on
 *     each rule's natural-language condition, then executes the matching
 *     rule's instruction – no hardcoded string matching
 */
import { SkillLoader } from './skill-loader';
import { createToolRegistry } from './create-tool-registry';
import { runToolLoop } from './tool-loop';
import { buildSystemPrompt } from './system-prompt';
import { DebugLogger } from './debug-logger';
import type { LLMProvider, Message } from '../llm/types';
import type { CredentialManager } from '../permissions/credential-manager';
import type { NotificationRule } from './notification-rules-store';

const TAG = 'NotifAgent';

// ── Config & payload types ────────────────────────────────────────────────

export interface NotificationSubAgentConfig {
  provider: LLMProvider;
  credentialManager: CredentialManager;
  enabledSkillNames: string[];
  drivingMode: boolean;
  language: string;
  soul?: string;
  personalMemory?: string;
  /** Maximum number of tool loop iterations (default: 8) */
  maxIterations?: number;
}

export interface NotificationPayload {
  appName: string;
  sender: string;
  subject: string;
  preview: string;
  packageName: string;
}

// ── Sub-agent execution ───────────────────────────────────────────────────

/**
 * Run a notification sub-agent.
 *
 * @param config      Agent configuration (provider, tools, language, etc.)
 * @param notification  The incoming notification data
 * @param rules       All enabled rules for this notification's app.
 *                    The LLM evaluates each rule's condition and executes
 *                    the first matching instruction.
 */
export async function runNotificationSubAgent(
  config: NotificationSubAgentConfig,
  notification: NotificationPayload,
  rules: NotificationRule[],
): Promise<string> {
  const { provider, credentialManager, enabledSkillNames, drivingMode, language, soul, personalMemory, maxIterations } = config;

  DebugLogger.add(
    'info',
    TAG,
    `▶ Processing: ${notification.appName} – ${notification.sender}`,
    [
      `Rules (${rules.length}):`,
      ...rules.map((r, i) =>
        `  ${i + 1}. [${r.id}] ${r.condition ? `IF: ${r.condition}` : '(catch-all)'} → ${r.instruction}`,
      ),
      `---`,
      `Notification: ${JSON.stringify(notification, null, 2)}`,
    ].join('\n'),
  );

  // 1. Create tool registry (no TTS – result is passed to foreground; no scheduler to prevent recursion)
  DebugLogger.add('info', TAG, 'Creating tool registry…');
  const skillLoader = new SkillLoader();
  const toolRegistry = createToolRegistry({
    credentialManager,
    skillLoader,
    includeTts: false,
    includeScheduler: false,
    includePersonalMemoryTool: false,
  });

  toolRegistry.removeDisabledSkillTools(skillLoader, enabledSkillNames);

  const toolNames = toolRegistry.list();
  DebugLogger.add(
    'info',
    TAG,
    `Tools (${toolNames.length}): ${toolNames.join(', ')}`,
  );

  // 2. Build system prompt
  const systemPrompt = buildSystemPrompt({
    skillLoader,
    toolRegistry,
    enabledSkillNames,
    drivingMode,
    language,
    soul,
    personalMemory,
  });
  DebugLogger.add(
    'info',
    TAG,
    `System prompt (${systemPrompt.length} chars)`,
    systemPrompt.slice(0, 500) + (systemPrompt.length > 500 ? '\n…(truncated)' : ''),
  );

  // 3. Build user instruction with notification context + rules
  const isEmail =
    notification.appName === 'Email' || notification.appName === 'Gmail';

  // Format the rules for the LLM
  const rulesBlock = rules.map((r, i) => {
    const condLine = r.condition
      ? `   Condition: ${r.condition}`
      : `   Condition: (none – always applies)`;
    return `Rule ${i + 1}:\n${condLine}\n   Instruction: ${r.instruction}`;
  }).join('\n\n');

  const parts = [
    `[NOTIFICATION – automatic, not typed by the user]`,
    `App: ${notification.appName}`,
    notification.sender ? `Sender: ${notification.sender}` : '',
    notification.subject ? `Subject: ${notification.subject}` : '',
    notification.preview ? `Message: ${notification.preview}` : '',
    ``,
    `You are a background sub-agent processing a single notification.`,
    `There is no direct user interaction — do not ask questions.`,
    ``,
    rules.length === 1 && !rules[0].condition
      // Single catch-all rule: just execute it
      ? `YOUR TASK:\n${rules[0].instruction}`
      // Multiple rules or conditional: LLM must evaluate
      : [
          `The user has configured the following notification rules for this app.`,
          `Evaluate each rule's condition against the notification above.`,
          `Execute the FIRST rule whose condition matches (or the catch-all rule if no conditional rule matches).`,
          `If NO rule matches at all, respond with EXACTLY the text __NO_MATCH__ and nothing else. Do NOT use any tools.`,
          ``,
          rulesBlock,
        ].join('\n'),
    ``,
    `Respond in the language with BCP-47 code "${language}".`,
    ``,
    isEmail
      ? `Context: for follow-up email detail, search with: from:${notification.sender} subject:${notification.subject}`
      : '',
  ];

  const userInstruction = parts.filter(Boolean).join('\n');

  DebugLogger.add(
    'info',
    TAG,
    `User instruction for sub-agent`,
    userInstruction,
  );

  // 4. Run the sub-agent tool loop
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userInstruction },
  ];

  try {
    const resolvedMaxIterations = maxIterations ?? 8;
    DebugLogger.add('info', TAG, `Starting tool loop (max ${resolvedMaxIterations} iterations)…`);

    const result = await runToolLoop(
      {
        provider,
        model: provider.getDefaultModel(),
        tools: toolRegistry,
        maxIterations: resolvedMaxIterations,
      },
      messages,
    );

    DebugLogger.add(
      'info',
      TAG,
      `✅ Done (${result.iterations} iter): ${notification.appName} – ${notification.sender}`,
      result.content,
    );

    return result.content;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    DebugLogger.add('error', TAG, `Sub-agent failed: ${errMsg}`);
    throw err;
  }
}

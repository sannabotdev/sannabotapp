/**
 * System Prompt Builder
 * Assembles the full system prompt from: identity + skills + tool summaries
 *
 * The prompt is always written in English (for best LLM reasoning quality).
 * The configured app language is enforced via an explicit rule so that the
 * assistant always responds in the user's chosen language.
 *
 * Also provides centralized text generation functions for headless tasks that
 * respect drivingMode and language settings consistently with the main system prompt.
 */
import type { SkillLoader } from './skill-loader';
import type { ToolRegistry } from './tool-registry';
import type { LLMProvider } from '../llm/types';
import { DebugLogger } from './debug-logger';
import { SoulStore } from './soul-store';
import { PersonalMemoryStore } from './personal-memory-store';

export interface SystemPromptConfig {
  skillLoader: SkillLoader;
  toolRegistry: ToolRegistry;
  enabledSkillNames: string[];
  drivingMode: boolean;
  /** BCP-47 language tag or 'system'. Defaults to 'en'. */
  language?: string;
  /** Optional user-defined persona instructions (SOUL.md equivalent). */
  soul?: string;
  /** Optional personal memory markdown (MEMORY.md equivalent). */
  personalMemory?: string;
}

/** Map a BCP-47 tag to a human-readable language name.
 *  NOTE: 'system' should be resolved to a real locale before calling this
 *  function. If it isn't, we fall back to the device Intl locale. */
function resolveLanguageName(lang: string | undefined): string {
  let tag = (lang ?? 'en').toLowerCase();

  // 'system' should already be resolved by the caller, but handle it as a
  // safety net so the LLM is never told to respond in "system".
  if (tag === 'system') {
    try {
      tag = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().replace('_', '-');
    } catch {
      tag = 'en';
    }
  }

  if (tag.startsWith('de')) return 'German (Deutsch)';
  if (tag.startsWith('en')) return 'English';
  if (tag.startsWith('fr')) return 'French (Français)';
  if (tag.startsWith('es')) return 'Spanish (Español)';
  if (tag.startsWith('it')) return 'Italian (Italiano)';
  // Unknown locale – pass the raw tag so the LLM can still try
  return lang ?? 'English';
}

export function buildSystemPrompt(config: SystemPromptConfig): string {
  const { skillLoader, toolRegistry, enabledSkillNames, drivingMode, language, soul, personalMemory } = config;

  const langName = resolveLanguageName(language);

  const now = new Date();
  // ISO date (YYYY-MM-DD) for precise date arithmetic
  const isoDate = now.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
  const dateStr = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts: string[] = [];

  // Identity section
  parts.push(`# Sanna – Mobile AI Assistant

You are Sanna, a personal AI assistant running on an Android smartphone.
You are primarily operated by voice and respond in the user's configured language.

## Current Time
${dateStr}
**Today is: ${isoDate}** (use this date for all date comparisons and calculations)

## Operating Mode
${drivingMode
  ? `**DRIVING MODE ACTIVE**
- **Headline style.** Drop articles, auxiliary verbs, and filler words. Speak like a news ticker.
- MAX 1 sentence (2 only if a follow-up question is needed).
- No Markdown, no lists, no headings, no preamble.
- Good: "Battery 80 percent." / "Mail from John – no subject." / "Navigation started."
- Bad: "Your battery currently has a charge level of 80 percent." / "I found an email from John."
- If you need more info from the user, ask in ONE short question – headline style too.
- **Time formatting:** Always write times in a format that reads naturally when spoken aloud in the target language. Avoid bare "HH:MM" format – use words that make it clear it's a time (e.g., "11 Uhr 23" in German, "11:23 AM" in English).
- **Always use correct punctuation.** End statements with a period (.) and questions with a question mark (?). This is critical – the app uses punctuation to detect whether you are asking something.`
  : `**Normal Mode**
- You may use Markdown formatting (headings, lists, code blocks, bold, etc.).
- Respond in detail when helpful.`}

## Important Rules

1. **ALWAYS use tools** – If you need to perform an action, use the appropriate tool. Never just say you would do it.
2. **Language** – You MUST respond in **${langName}**. Always use this language for every reply, regardless of the language the user writes in, unless the user explicitly asks you to switch languages.
3. **Errors** – When something goes wrong, clearly tell the user what happened.`);

  const trimmedSoul = soul?.trim();
  if (trimmedSoul) {
    parts.push(`## SOUL (Persona)

Follow this persona/tone unless it conflicts with higher-priority rules (tool execution, safety, language policy).

${trimmedSoul}`);
  }

  const trimmedMemory = personalMemory?.trim();
  const hasMemoryUpsertTool = !!toolRegistry.get('memory_personal_upsert');
  if (trimmedMemory || hasMemoryUpsertTool) {
    parts.push(`## Personal Memory (MEMORY.md)

Use this as durable user context (name, family, work, location, hobbies, favorite places/preferences).
Also includes important personal dates/events (birthdays, namedays, all anniversaries, major life events).

${hasMemoryUpsertTool
  ? `**Memory-first rule:** Before doing anything else, scan the user's message for stable personal facts (name, family member, job, location, hobby, birthday, anniversary, important event, etc.). If you detect one or more, call \`memory_personal_upsert\` immediately as your very first tool call with an array of facts. Each fact can have its own category. Example: [{"fact": "Sister is Karla", "category": "family"}, {"fact": "Sister Karla's birthday is 6 April", "category": "anniversaries"}]. Only after that proceed with the actual request (skill lookup, tool execution, etc.).`
  : 'This context is read-only in this agent; do not attempt to modify it.'}

${trimmedMemory || '(No personal facts stored yet.)'}`);
  }

  // Tools section
  const toolSummaries = toolRegistry.getSummaries();
  if (toolSummaries.length > 0) {
    parts.push(`## Available Tools

**IMPORTANT**: Use tools to perform actions. Do NOT just describe actions in text – execute them.

${toolSummaries.join('\n')}`);
  }

  // Skills section
  const skillsSummary = skillLoader.buildSkillsSummary(enabledSkillNames);
  if (skillsSummary) {
    parts.push(`## Available Skills

The following skills extend your capabilities. Each skill has a summary that indicates which tools and parameters to use.

**CRITICAL: How to use skills (MANDATORY WORKFLOW):**
1. Review the skill summaries below to identify which skill applies to the user's request.
2. **BEFORE using any skill, you MUST call \`skill_detail\` with the skill name as your FIRST action.** This is MANDATORY - never skip this step.
3. **If a personal fact was detected above**, call \`memory_personal_upsert\` first, then \`skill_detail\`, then proceed.
4. **If no personal fact was detected**, call \`skill_detail\` immediately as your very first tool call.
5. Only after reading the full skill definition via \`skill_detail\`, proceed with the tools and parameters described in it.
6. **NEVER attempt to use a skill without first calling \`skill_detail\`** - the summaries are not sufficient for execution.

${skillsSummary}`);
  }

  return parts.join('\n\n---\n\n');
}

// ── Centralized Text Generation Functions ──────────────────────────────────────

/**
 * Builds the output style description based on drivingMode, matching the main system prompt.
 */
function getOutputStyleDescription(drivingMode: boolean): string {
  if (drivingMode) {
    return `**DRIVING MODE ACTIVE**
- **Headline style.** Drop articles, auxiliary verbs, and filler words. Speak like a news ticker.
- MAX 1 sentence (2 only if a follow-up question is needed).
- No Markdown, no lists, no headings, no preamble.
- Good: "Battery 80 percent." / "Mail from John – no subject." / "Navigation started."
- Bad: "Your battery currently has a charge level of 80 percent." / "I found an email from John."
- If you need more info from the user, ask in ONE short question – headline style too.
- **Time formatting:** Always write times in a format that reads naturally when spoken aloud in the target language. Avoid bare "HH:MM" format – use words that make it clear it's a time (e.g., "11 Uhr 23" in German, "11:23 AM" in English).
- **Always use correct punctuation.** End statements with a period (.) and questions with a question mark (?). This is critical – the app uses punctuation to detect whether you are asking something.`;
  } else {
    return `**Normal Mode**
- You may use Markdown formatting (headings, lists, code blocks, bold, etc.).
- Respond in detail when helpful.`;
  }
}

/**
 * Ask the LLM to turn a raw error into a short, user-friendly message
 * in the user's language. Falls back to the raw message if the LLM call fails.
 */
export async function formulateError(opts: {
  provider: LLMProvider;
  model: string;
  instruction: string;
  rawError: string;
  drivingMode: boolean;
  language: string;
}): Promise<string> {
  const { provider, model, instruction, rawError, drivingMode, language } = opts;

  // Load soul and personal memory directly from stores
  const soul = await SoulStore.getSoul();
  const personalMemory = await PersonalMemoryStore.getMemory();

  const langName = resolveLanguageName(language);
  const outputStyle = getOutputStyleDescription(drivingMode);

  const parts: string[] = [];
  parts.push(`You are Sanna, a friendly AI assistant reporting the outcome of a scheduled background task.`);
  parts.push(`## Operating Mode\n${outputStyle}`);
  parts.push(`## Important Rules
1. **Language** – You MUST respond in **${langName}**. Always use this language for every reply.
2. Base your reply on the user's original instruction, not on technical internals.
3. Explain what did NOT work in plain language. Do NOT include stack traces or error codes.
4. If possible, hint at what the user could do to fix it.`);

  const trimmedSoul = soul?.trim();
  if (trimmedSoul) {
    parts.push(`## SOUL (Persona)

Follow this persona/tone unless it conflicts with higher-priority rules (tool execution, safety, language policy).

${trimmedSoul}`);
  }

  const trimmedMemory = personalMemory?.trim();
  if (trimmedMemory) {
    parts.push(`## Personal Memory (Read-only)

Use this as durable user context (name, family, work, location, hobbies, favorite places/preferences).
Also includes important personal dates/events (birthdays, namedays, all anniversaries, major life events).

${trimmedMemory}`);
  }

  const systemPrompt = parts.join('\n\n');

  const userPrompt =
    `Scheduled instruction: ${instruction}\n` +
    `Error: ${rawError}`;

  DebugLogger.add('llm', 'FormulateError', `Formulating error response for "${instruction}"`, userPrompt);

  try {
    const response = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      [],
      model,
    );
    const result = response.content?.trim() || rawError;
    DebugLogger.add('llm', 'FormulateError', `Formatted error → ${result}`);
    return result;
  } catch (err) {
    DebugLogger.add('error', 'FormulateError', `formulateError LLM call failed: ${err}`);
    return rawError;
  }
}

/**
 * Generate a short spoken announcement acknowledging receipt and indicating
 * that the notification is being processed.
 * Falls back to a simple template if the LLM call fails.
 */
export async function generateAnnouncement(opts: {
  provider: LLMProvider;
  model: string;
  appName: string;
  sender: string;
  preview: string;
  language: string;
  drivingMode: boolean;
}): Promise<string> {
  const { provider, model, appName, sender, preview, language, drivingMode } = opts;

  const langName = resolveLanguageName(language);
  const outputStyle = getOutputStyleDescription(drivingMode);

  const systemPrompt =
    `You are Sanna, a friendly AI assistant acknowledging receipt of a notification. ` +
    `\n\n## Operating Mode\n${outputStyle}\n\n` +
    `## Important Rules\n` +
    `1. **Language** – You MUST respond in **${langName}**. Always use this language for every reply. ` +
    `2. Generate exactly ONE short spoken sentence (max 10 words) acknowledging receipt and that you are now processing it. ` +
    `3. No markdown. ` +
    `4. Example: "WhatsApp von John erhalten, verarbeite…"`;

  const userPrompt =
    `App: ${appName}\n` +
    `Sender: ${sender}\n` +
    (preview ? `Preview: ${preview.slice(0, 80)}\n` : '') +
    `\n` +
    `Generate exactly ONE short spoken sentence (max 10 words) acknowledging receipt ` +
    `and that you are now processing it. No markdown. ` +
    `Example: "WhatsApp von John erhalten, verarbeite…"\n` +
    `Respond in the language with BCP-47 code "${language}".`;

  try {
    const response = await provider.chat(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      [],
      model,
    );
    return response.content?.trim() || `${appName} von ${sender} erhalten, verarbeite…`;
  } catch (err) {
    DebugLogger.add('error', 'GenerateAnnouncement', `Announcement LLM call failed: ${err}`);
    return `${appName} von ${sender} erhalten, verarbeite…`;
  }
}

/**
 * Ask the LLM to reformulate a result (success or failure) as a natural
 * assistant response in the user's language, tailored to the output mode.
 *
 * Driving mode  → short spoken sentence, no markdown
 * Normal mode   → concise markdown bubble with a status icon
 *
 * Falls back to the raw message if the LLM call itself fails.
 */
export async function formulateResponse(opts: {
  provider: LLMProvider;
  model: string;
  packageName: string;
  goal: string;
  status: 'success' | 'failed' | 'timeout';
  rawMessage: string;
  drivingMode: boolean;
  language: string;
}): Promise<string> {
  const { provider, model, packageName, goal, status, rawMessage, drivingMode, language } = opts;

  // Load soul and personal memory directly from stores
  const soul = await SoulStore.getSoul();
  const personalMemory = await PersonalMemoryStore.getMemory();

  const langName = resolveLanguageName(language);
  const outputStyle = getOutputStyleDescription(drivingMode);

  const parts: string[] = [];
  parts.push(`You are Sanna, a friendly AI assistant confirming the outcome of a background task.`);
  parts.push(`## Operating Mode\n${outputStyle}`);
  parts.push(`## Important Rules
1. **Language** – You MUST respond in **${langName}**. Always use this language for every reply.
2. Base your reply on what the USER wanted to achieve (the Goal), not on the technical steps the automation took.
3. Do NOT mention clicking, typing, tapping, nodes, buttons, or any UI internals.
4. On success: confirm the user's intent was fulfilled in one short sentence.
5. On failure: explain what did NOT work in plain language, in one short sentence.
6. The app package name is provided – refer to it by its common name (e.g. "com.whatsapp" → "WhatsApp").`);

  const trimmedSoul = soul?.trim();
  if (trimmedSoul) {
    parts.push(`## SOUL (Persona)

Follow this persona/tone unless it conflicts with higher-priority rules (tool execution, safety, language policy).

${trimmedSoul}`);
  }

  const trimmedMemory = personalMemory?.trim();
  if (trimmedMemory) {
    parts.push(`## Personal Memory (Read-only)

Use this as durable user context (name, family, work, location, hobbies, favorite places/preferences).
Also includes important personal dates/events (birthdays, namedays, all anniversaries, major life events).

${trimmedMemory}`);
  }

  const systemPrompt = parts.join('\n\n');

  const userPrompt =
    `App package: ${packageName}\n` +
    `Goal: ${goal}\n` +
    `Status: ${status}\n` +
    `Raw result: ${rawMessage}`;

  DebugLogger.add(
    'llm',
    'FormulateResponse',
    `Formulating ${status} response for "${goal}"`,
    `System:\n${systemPrompt}\n\nUser:\n${userPrompt}`,
  );

  try {
    const response = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      [],
      model,
    );
    const result = response.content?.trim() || rawMessage;
    DebugLogger.add('llm', 'FormulateResponse', `→ ${result}`);
    return result;
  } catch (err) {
    DebugLogger.add('error', 'FormulateResponse', `LLM call failed: ${err}`);
    return rawMessage;
  }
}

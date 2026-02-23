/**
 * System Prompt Builder
 * Assembles the full system prompt from: identity + skills + tool summaries
 *
 * The prompt is always written in English (for best LLM reasoning quality).
 * The configured app language is enforced via an explicit rule so that the
 * assistant always responds in the user's chosen language.
 */
import type { SkillLoader } from './skill-loader';
import type { ToolRegistry } from './tool-registry';

export interface SystemPromptConfig {
  skillLoader: SkillLoader;
  toolRegistry: ToolRegistry;
  enabledSkillNames: string[];
  drivingMode: boolean;
  /** BCP-47 language tag or 'system'. Defaults to 'en'. */
  language?: string;
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
  const { skillLoader, toolRegistry, enabledSkillNames, drivingMode, language } = config;

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
- MAX 1–2 sentences. Be extremely brief.
- Plain spoken language only – no Markdown, no lists, no headings, no punctuation tricks.
- One fact per answer. Skip all filler, preamble, and explanations.
- Good: "Dein Akku hat 80 Prozent." Bad: "Dein Akku hat momentan einen Ladestand von 80 Prozent, was bedeutet..."
- Your response is read aloud immediately – every extra word wastes the driver's attention.`
  : `**Normal Mode**
- You may use Markdown formatting (headings, lists, code blocks, bold, etc.).
- Respond in detail when helpful.`}

## Important Rules

1. **ALWAYS use tools** – If you need to perform an action, use the appropriate tool. Never just say you would do it.
2. **Language** – You MUST respond in **${langName}**. Always use this language for every reply, regardless of the language the user writes in, unless the user explicitly asks you to switch languages.
3. **Errors** – When something goes wrong, clearly tell the user what happened.`);

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

The following skills extend your capabilities. Each skill explains which tools and parameters to use.

${skillsSummary}`);
  }

  // Skill content (full SKILL.md bodies)
  const skillsContent = skillLoader.buildSkillsContent(enabledSkillNames);
  if (skillsContent) {
    parts.push(`## Skill Definitions\n\n${skillsContent}`);
  }

  return parts.join('\n\n---\n\n');
}

import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import { PersonalMemoryStore } from '../agent/personal-memory-store';
import { DebugLogger } from '../agent/debug-logger';
import type { LLMProvider } from '../llm/types';

const UPSERT_PROMPT = `You are a personal memory curator. You maintain a markdown document of personal facts about the user.

You will receive:
1. The current memory document (may be empty)
2. A new fact to integrate

Your job: return the updated memory document with the new fact correctly integrated.

Rules:
- Integrate the new fact into the correct ## section.
- If a very similar or conflicting fact already exists, replace it with the new one.
- Remove exact or near-exact duplicates.
- Keep all other facts unchanged.
- Each fact is a "- " bullet, written in English, concise and factual.
- Keep all ## section headers. Do not add or remove sections.
- Do NOT add commentary, preamble, or explanation.
- Return ONLY the updated markdown document.

Sections: Identity, Family, Work, Location, Hobbies, Favorites, Anniversaries, Important Dates, Important Events, Other`;

const EMPTY_MEMORY = `# Personal Memory

## Identity

## Family

## Work

## Location

## Hobbies

## Favorites

## Anniversaries

## Important Dates

## Important Events

## Other
`;

export class PersonalMemoryTool implements Tool {
  private provider?: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider;
  }

  name(): string {
    return 'memory_personal_upsert';
  }

  description(): string {
    return 'Store or update durable personal user facts in English. Use for stable facts: name, family, work, location, hobbies, favorites, birthdays, namedays, anniversaries, wedding anniversary, important events and dates. Do not pass questions, meta-dialogue, or temporary chatter.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        fact: {
          type: 'string',
          description: 'A concise stable personal fact in English (statement only, not a question, no meta-dialogue). Example: "Wedding anniversary is 14 May."',
          minLength: 3,
          maxLength: 240,
          pattern: '^(?!.*\\?$).+',
        },
        category: {
          type: 'string',
          enum: [
            'identity',
            'family',
            'work',
            'location',
            'hobby',
            'favorites',
            'anniversaries',
            'important_dates',
            'important_events',
            'other',
          ],
          description: 'Category hint for the section where the fact belongs.',
        },
      },
      required: ['fact', 'category'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const fact = typeof args.fact === 'string' ? args.fact.trim() : '';

    if (!fact) {
      return errorResult('Missing or empty "fact".');
    }

    try {
      const current = await PersonalMemoryStore.getMemory();
      const base = current.trim() ? current : EMPTY_MEMORY;

      let updated: string;
      if (this.provider) {
        updated = await this.upsertViaLLM(base, fact);
      } else {
        // Fallback: append fact as-is under Other
        updated = `${base.trimEnd()}\n- ${fact}\n`;
      }

      await PersonalMemoryStore.saveMemory(updated);
      return successResult(`Saved personal memory: ${fact}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to persist personal memory: ${message}`);
    }
  }

  private async upsertViaLLM(memoryText: string, fact: string): Promise<string> {
    const messages = [
      { role: 'system' as const, content: UPSERT_PROMPT },
      {
        role: 'user' as const,
        content: `Current memory:\n\n${memoryText}\n\n---\n\nNew fact to integrate: ${fact}`,
      },
    ];
    DebugLogger.logLLMRequest(this.provider!.getDefaultModel(), messages.length, 0, messages);
    const response = await this.provider!.chat(messages, [], this.provider!.getDefaultModel());
    DebugLogger.logLLMResponse(response.content, [], response.usage, response);
    const result = response.content?.trim();
    // Safety: if LLM returns empty/garbage, keep original
    return result && result.length > 10 ? result : memoryText;
  }
}

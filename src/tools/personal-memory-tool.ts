import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import { PersonalMemoryStore } from '../agent/personal-memory-store';
import { DebugLogger } from '../agent/debug-logger';
import type { LLMProvider } from '../llm/types';

const UPSERT_PROMPT = `You are a personal memory curator. You maintain a markdown document of personal facts about the user.

You will receive:
1. The current memory document (may be empty)
2. One or more new facts to integrate, each with its category

Your job: return the updated memory document with all new facts correctly integrated.

Rules:
- Integrate each new fact into the correct ## section based on its category.
- If a very similar or conflicting fact already exists, replace it with the new one.
- Remove exact or near-exact duplicates.
- Keep all other facts unchanged.
- Each fact is a "- " bullet, written in English, concise and factual.
- Keep all ## section headers. Do not add or remove sections.
- Do NOT add commentary, preamble, or explanation.
- Return ONLY the updated markdown document.

Sections: Identity, Family, Work, Location, Hobbies, Favorites, Anniversaries, Important Dates, Important Events, Other`;

type MemoryCategory =
  | 'identity'
  | 'family'
  | 'work'
  | 'location'
  | 'hobby'
  | 'favorites'
  | 'anniversaries'
  | 'important_dates'
  | 'important_events'
  | 'other';

const CATEGORY_HEADERS: Record<MemoryCategory, string> = {
  identity: 'Identity',
  family: 'Family',
  work: 'Work',
  location: 'Location',
  hobby: 'Hobbies',
  favorites: 'Favorites',
  anniversaries: 'Anniversaries',
  important_dates: 'Important Dates',
  important_events: 'Important Events',
  other: 'Other',
};

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
    return 'Store or update durable personal user facts in English. Use for stable facts: name, family, work, location, hobbies, favorites, birthdays, namedays, anniversaries, wedding anniversary, important events and dates. Do not pass questions, meta-dialogue, or temporary chatter. You can pass multiple facts at once.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        facts: {
          type: 'array',
          items: {
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
                description: 'Category for organizing this personal memory fact.',
              },
            },
            required: ['fact', 'category'],
          },
          description: 'Array of personal facts to store. Each fact can have its own category. Example: [{"fact": "Sister is Karla", "category": "family"}, {"fact": "Sister Karla\'s birthday is 6 April", "category": "anniversaries"}]',
          minItems: 1,
          maxItems: 10,
        },
      },
      required: ['facts'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    if (!Array.isArray(args.facts) || args.facts.length === 0) {
      return errorResult('Missing or empty "facts" array.');
    }

    const facts: Array<{ fact: string; category: string }> = [];
    for (const item of args.facts) {
      if (typeof item === 'object' && item !== null) {
        const fact = typeof item.fact === 'string' ? item.fact.trim() : '';
        const category = typeof item.category === 'string' ? item.category : '';
        if (fact && category && category in CATEGORY_HEADERS) {
          facts.push({ fact, category });
        }
      }
    }

    if (facts.length === 0) {
      return errorResult('No valid facts provided. Each fact must have "fact" (string) and "category" (valid enum value).');
    }

    if (!this.provider) {
      return errorResult('LLM provider not available for memory operations.');
    }

    try {
      const current = await PersonalMemoryStore.getMemory();
      const base = current.trim() ? current : EMPTY_MEMORY;
      const updated = await this.upsertViaLLM(base, facts);
      await PersonalMemoryStore.saveMemory(updated);
      
      const factSummary = facts.length === 1 ? facts[0].fact : `${facts.length} facts`;
      return successResult(`Saved personal memory: ${factSummary}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to persist personal memory: ${message}`);
    }
  }

  private async upsertViaLLM(memoryText: string, facts: Array<{ fact: string; category: string }>): Promise<string> {
    const factsText = facts.length === 1
      ? `New fact to integrate: "${facts[0].fact}" (category: ${facts[0].category})`
      : `New facts to integrate:\n${facts.map((f, i) => `${i + 1}. "${f.fact}" (category: ${f.category})`).join('\n')}`;

    const messages = [
      { role: 'system' as const, content: UPSERT_PROMPT },
      {
        role: 'user' as const,
        content: `Current memory:\n\n${memoryText}\n\n---\n\n${factsText}`,
      },
    ];
    DebugLogger.logLLMRequest(this.provider!.getCurrentModel(), messages.length, 0, messages);
    const response = await this.provider!.chat(messages, []);
    DebugLogger.logLLMResponse(response.content, [], response.usage, response);
    const result = response.content?.trim();
    // Safety: if LLM returns empty/garbage, keep original
    return result && result.length > 10 ? result : memoryText;
  }
}

import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import { PersonalMemoryStore } from '../agent/personal-memory-store';

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

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildEmptyMemory(): string {
  const lines: string[] = ['# Personal Memory', ''];
  for (const key of Object.keys(CATEGORY_HEADERS) as MemoryCategory[]) {
    lines.push(`## ${CATEGORY_HEADERS[key]}`);
    lines.push('');
  }
  return lines.join('\n');
}

function upsertFact(
  memoryText: string,
  category: MemoryCategory,
  fact: string,
  replaceSimilar: boolean,
): string {
  const base = memoryText.trim() ? memoryText : buildEmptyMemory();
  const lines = base.split('\n');
  const header = `## ${CATEGORY_HEADERS[category]}`;
  const factLine = `- ${fact.trim()}`;

  let start = lines.findIndex(line => line.trim() === header);
  if (start === -1) {
    lines.push('');
    lines.push(header);
    lines.push('');
    start = lines.length - 1;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }

  const sectionLines = lines.slice(start + 1, end);
  const bulletIndexes = sectionLines
    .map((line, idx) => ({ line, idx }))
    .filter(entry => entry.line.trim().startsWith('- '))
    .map(entry => entry.idx);

  const normalizedFact = normalize(fact);
  const hasExact = bulletIndexes.some(i => normalize(sectionLines[i].slice(2)) === normalizedFact);
  if (hasExact) {
    return lines.join('\n');
  }

  if (replaceSimilar) {
    const firstWord = normalizedFact.split(' ')[0];
    const similarIdx = bulletIndexes.find(i => {
      const existing = normalize(sectionLines[i].slice(2));
      return existing.startsWith(firstWord) || normalizedFact.startsWith(existing.split(' ')[0]);
    });
    if (similarIdx !== undefined) {
      sectionLines[similarIdx] = factLine;
      const updated = [...lines.slice(0, start + 1), ...sectionLines, ...lines.slice(end)];
      return updated.join('\n');
    }
  }

  const insertAt = start + 1 + sectionLines.length;
  lines.splice(insertAt, 0, factLine);
  return lines.join('\n');
}

export class PersonalMemoryTool implements Tool {
  name(): string {
    return 'memory_personal_upsert';
  }

  description(): string {
    return 'Store or update durable personal user facts in English. Use for stable facts (name, family, work, location, hobbies, favorites, birthdays, namedays, anniversaries, important events). Do not pass questions, meta-dialogue, or temporary chatter.';
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
          description: 'Category for organizing personal memory facts.',
        },
        replace_similar: {
          type: 'boolean',
          description: 'If true, replace a very similar existing fact in the same category.',
        },
      },
      required: ['fact', 'category'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const fact = typeof args.fact === 'string' ? args.fact.trim() : '';
    const category = args.category as MemoryCategory;
    const replaceSimilar = typeof args.replace_similar === 'boolean' ? args.replace_similar : true;

    if (!fact) {
      return errorResult('Missing or empty "fact".');
    }
    if (!category || !(category in CATEGORY_HEADERS)) {
      return errorResult('Invalid "category".');
    }

    try {
      const current = await PersonalMemoryStore.getMemory();
      const updated = upsertFact(current, category, fact, replaceSimilar);
      await PersonalMemoryStore.saveMemory(updated);
      return successResult(
        `Saved personal memory fact in "${CATEGORY_HEADERS[category]}": ${fact}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to persist personal memory: ${message}`);
    }
  }
}

/**
 * ContextManager – Session history with summarization and compression
 *   - Tracks token usage across messages
 *   - Summarizes old messages when context window gets full
 *   - Preserves the most recent messages verbatim
 */
import type { LLMProvider, Message } from '../llm/types';

export interface ContextConfig {
  /** Max messages before compression (default: 20) */
  maxMessages: number;
  /** How many recent messages to keep verbatim (default: 6) */
  keepRecentCount: number;
  /** LLM provider for generating summaries */
  summarizeProvider: LLMProvider;
  /** Model to use for summarization */
  summarizeModel: string;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxMessages: 20,
  keepRecentCount: 6,
  summarizeProvider: null as unknown as LLMProvider, // Must be provided
  summarizeModel: 'claude-haiku-5-5',
};

export interface ContextStats {
  totalMessages: number;
  hasSummary: boolean;
  summaryMessageCount: number;
}

export class ContextManager {
  private config: ContextConfig;
  private history: Message[] = [];
  private summaryPrefix: string | null = null;
  private summarizedMessageCount = 0;

  constructor(config: Partial<ContextConfig> & { summarizeProvider: LLMProvider }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Add a message to history */
  add(message: Message): void {
    this.history.push(message);
  }

  /** Get current stats */
  getStats(): ContextStats {
    return {
      totalMessages: this.history.length + (this.summaryPrefix ? 1 : 0),
      hasSummary: this.summaryPrefix !== null,
      summaryMessageCount: this.summarizedMessageCount,
    };
  }

  /**
   * Get the full message list for the LLM.
   * If a summary exists, it's prepended as a system message context.
   */
  getMessages(): Message[] {
    if (!this.summaryPrefix) {
      return [...this.history];
    }

    return [
      {
        role: 'user',
        content: `[Summary of earlier conversation]\n${this.summaryPrefix}\n[End of summary]`,
      },
      {
        role: 'assistant',
        content: 'I have noted the summary of the previous conversation.',
      },
      ...this.history,
    ];
  }

  /**
   * Check if context should be compressed and do it if needed.
   * Returns true if compression was performed.
   */
  async maybeCompress(): Promise<boolean> {
    if (this.history.length < this.config.maxMessages) {
      return false;
    }

    await this.compress();
    return true;
  }

  /**
   * Force compress: summarize old messages, keep recent ones verbatim.
   */
  async compress(): Promise<void> {
    const keepCount = this.config.keepRecentCount;
    const toSummarize = this.history.slice(0, this.history.length - keepCount);
    const toKeep = this.history.slice(this.history.length - keepCount);

    if (toSummarize.length === 0) return;

    // Re-condense existing summary + newly aged-out messages into one summary.
    this.summaryPrefix = await this.summarize(toSummarize, this.summaryPrefix);

    this.summarizedMessageCount += toSummarize.length;
    this.history = toKeep;
  }

  /**
   * Generate a summary using the LLM.
   * When an existing summary is present, the model rewrites it together with the
   * newly aged-out messages into a fresh single summary.
   */
  private async summarize(messages: Message[], existingSummary: string | null): Promise<string> {
    const conversationText = messages
      .map(m => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
        return `${role}: ${m.content}`;
      })
      .join('\n\n');

    const existingBlock = existingSummary
      ? `Existing summary:
${existingSummary}

`
      : '';

    const summaryPrompt: Message[] = [
      {
        role: 'user',
        content: `Rewrite the conversation memory into ONE concise bullet-list summary.
Keep important facts, user preferences, decisions, commitments, unresolved tasks, and outcomes.
Remove duplication and stale details. Keep chronology where relevant.
Do not include meta commentary.

${existingBlock}Newly aged-out conversation messages:

${conversationText}

Updated summary:`,
      },
    ];

    try {
      const response = await this.config.summarizeProvider.chat(
        summaryPrompt,
        [],
        { maxTokens: 1024, temperature: 0 },
      );
      return response.content;
    } catch {
      // Fallback: preserve existing summary and append a short glimpse of new content.
      const words = conversationText.split(' ').slice(0, 100);
      const newTopics = `[Latest topics] ${words.join(' ')}...`;
      return existingSummary ? `${existingSummary}\n\n${newTopics}` : `[Summary not available] ${newTopics}`;
    }
  }

  /** Clear all history and summary */
  clear(): void {
    this.history = [];
    this.summaryPrefix = null;
    this.summarizedMessageCount = 0;
  }

  /** Export for persistence */
  export(): { history: Message[]; summary: string | null; count: number } {
    return {
      history: [...this.history],
      summary: this.summaryPrefix,
      count: this.summarizedMessageCount,
    };
  }

  /** Import from persistence */
  import(data: { history: Message[]; summary: string | null; count: number }): void {
    this.history = [...data.history];
    this.summaryPrefix = data.summary;
    this.summarizedMessageCount = data.count;
  }
}

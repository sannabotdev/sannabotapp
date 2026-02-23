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
  summarizeModel: 'claude-3-haiku-20240307',
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
        content: `[Zusammenfassung früherer Konversation]\n${this.summaryPrefix}\n[Ende der Zusammenfassung]`,
      },
      {
        role: 'assistant',
        content: 'Ich habe die Zusammenfassung der bisherigen Konversation zur Kenntnis genommen.',
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

    const summary = await this.summarize(toSummarize);

    // Combine with existing summary
    if (this.summaryPrefix) {
      this.summaryPrefix = `${this.summaryPrefix}\n\n${summary}`;
    } else {
      this.summaryPrefix = summary;
    }

    this.summarizedMessageCount += toSummarize.length;
    this.history = toKeep;
  }

  /** Generate a summary of a list of messages using the LLM */
  private async summarize(messages: Message[]): Promise<string> {
    const conversationText = messages
      .map(m => {
        const role = m.role === 'user' ? 'Nutzer' : m.role === 'assistant' ? 'Assistent' : m.role;
        return `${role}: ${m.content}`;
      })
      .join('\n\n');

    const summaryPrompt: Message[] = [
      {
        role: 'user',
        content: `Fasse die folgende Konversation kurz und prägnant zusammen. Behalte alle wichtigen Fakten, getroffene Entscheidungen und Aktionen. Nutze Stichpunkte.

Konversation:
${conversationText}

Zusammenfassung:`,
      },
    ];

    try {
      const response = await this.config.summarizeProvider.chat(
        summaryPrompt,
        [],
        this.config.summarizeModel,
        { maxTokens: 1024, temperature: 0 },
      );
      return response.content;
    } catch (err) {
      // Fallback: simple truncation summary
      const words = conversationText.split(' ').slice(0, 100);
      return `[Zusammenfassung nicht verfügbar] Themen: ${words.join(' ')}...`;
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

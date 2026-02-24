/**
 * ConversationStore – Two-key AsyncStorage persistence for conversation history
 *
 * Key design principle: each key has exactly ONE writer, eliminating race conditions.
 *
 * Key: 'conversation_history'
 *   Writer: Main app only (saveHistory, called after each turn)
 *   Reader: Main app only (loadHistory, called on startup)
 *   Max:    MAX_HISTORY entries (oldest dropped)
 *
 * Key: 'background_pending'
 *   Writer: Background HeadlessJS tasks only (appendPending)
 *   Reader: Main app only (drainPending, called when app comes to foreground)
 *   Max:    MAX_PENDING entries (oldest dropped)
 *
 * Both keys store StoredMessage[] in JSON.
 * Only clean user/assistant messages are stored (no tool calls, no tool results).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Constants ────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'conversation_history';
const PENDING_KEY = 'background_pending';

/** Max messages stored in conversation_history (shown in UI) */
const MAX_HISTORY = 50;

/** Max messages stored in background_pending (usually drained quickly) */
const MAX_PENDING = 10;

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoredMessage {
  role: 'user' | 'assistant';
  text: string;
  /** ISO-8601 timestamp string */
  timestamp: string;
}

// ── ConversationStore ─────────────────────────────────────────────────────────

export class ConversationStore {
  /**
   * Save the full conversation history (called by main app after each turn).
   * Truncates to the last MAX_HISTORY messages.
   */
  static async saveHistory(messages: StoredMessage[]): Promise<void> {
    const truncated = messages.slice(-MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(truncated));
  }

  /**
   * Load the persisted conversation history (called by main app on startup).
   * Returns an empty array if nothing is stored yet.
   */
  static async loadHistory(): Promise<StoredMessage[]> {
    try {
      const json = await AsyncStorage.getItem(HISTORY_KEY);
      if (!json) return [];
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed)) return [];
      // Validate shape – filter out any malformed entries
      return (parsed as StoredMessage[]).filter(
        m => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string',
      );
    } catch {
      return [];
    }
  }

  /**
   * Append a message to the background pending queue.
   * Called by HeadlessJS tasks (e.g. accessibility automation, scheduler).
   * Truncates the queue to the last MAX_PENDING messages.
   */
  static async appendPending(role: 'user' | 'assistant', text: string): Promise<void> {
    try {
      let current: StoredMessage[] = [];
      const json = await AsyncStorage.getItem(PENDING_KEY);
      if (json) {
        const parsed = JSON.parse(json) as unknown;
        if (Array.isArray(parsed)) {
          current = parsed as StoredMessage[];
        }
      }

      const newEntry: StoredMessage = {
        role,
        text,
        timestamp: new Date().toISOString(),
      };

      const updated = [...current, newEntry].slice(-MAX_PENDING);
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(updated));
    } catch {
      // Non-fatal: background task can't update UI – TTS is the fallback
    }
  }

  /**
   * Read and delete all pending messages (called by main app on foreground).
   * Returns the messages so they can be merged into the conversation.
   * Returns an empty array if nothing is pending.
   */
  static async drainPending(): Promise<StoredMessage[]> {
    try {
      const json = await AsyncStorage.getItem(PENDING_KEY);
      if (!json) return [];

      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      // Delete first so we don't show duplicates if the app crashes between drain+merge
      await AsyncStorage.removeItem(PENDING_KEY);

      return (parsed as StoredMessage[]).filter(
        m => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string',
      );
    } catch {
      return [];
    }
  }

  /**
   * Clear the full conversation history (e.g. when user clears chat).
   */
  static async clearHistory(): Promise<void> {
    await AsyncStorage.removeItem(HISTORY_KEY);
  }
}

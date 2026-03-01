/**
 * JournalStore – Persistent storage for journal entries
 *
 * Journal entries track activities, events, and notes with:
 *   - Creation timestamp (automatic)
 *   - Optional date range (dateFrom, dateTo)
 *   - Category (text)
 *   - Title/heading
 *   - Details/description
 *
 * Persistence: AsyncStorage (key "sanna_journal_entries")
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sanna_journal_entries';

// ── Data model ───────────────────────────────────────────────────────────────

export interface JournalEntry {
  /** Unique entry ID (UUID v4) */
  id: string;
  /** Creation timestamp (Unix ms) */
  createdAt: number;
  /** Optional: Start date (Unix ms) */
  dateFrom?: number;
  /** Optional: End date (Unix ms) */
  dateTo?: number;
  /** Category (text) */
  category: string;
  /** Title/heading */
  title: string;
  /** Details/description */
  details: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Store API ────────────────────────────────────────────────────────────────

/**
 * Load all journal entries from storage.
 * Returns entries sorted by creation time (newest first).
 */
export async function getEntries(): Promise<JournalEntry[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      return [];
    }
    const entries = JSON.parse(json) as JournalEntry[];
    // Sort by createdAt descending (newest first)
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/**
 * Get entries filtered by category.
 * Returns entries sorted by creation time (newest first).
 */
export async function getEntriesByCategory(category: string): Promise<JournalEntry[]> {
  const entries = await getEntries();
  return entries.filter(e => e.category === category);
}

/**
 * Get all unique categories from existing entries.
 */
export async function getCategories(): Promise<string[]> {
  const entries = await getEntries();
  const categories = new Set(entries.map(e => e.category));
  return Array.from(categories).sort();
}

/**
 * Add a new journal entry.
 * Returns the created entry.
 */
export async function addEntry(
  partial: Omit<JournalEntry, 'id' | 'createdAt'>,
): Promise<JournalEntry> {
  const entries = await getEntries();
  const entry: JournalEntry = {
    ...partial,
    id: generateId(),
    createdAt: Date.now(),
  };
  entries.push(entry);
  await saveEntries(entries);
  return entry;
}

/**
 * Get a single entry by ID.
 */
export async function getEntry(id: string): Promise<JournalEntry | null> {
  const entries = await getEntries();
  return entries.find(e => e.id === id) ?? null;
}

/**
 * Delete an entry by ID.
 * Returns true if deleted, false if not found.
 */
export async function deleteEntry(id: string): Promise<boolean> {
  const entries = await getEntries();
  const before = entries.length;
  const filtered = entries.filter(e => e.id !== id);
  if (filtered.length === before) {
    return false;
  }
  await saveEntries(filtered);
  return true;
}

/**
 * Delete all entries.
 */
export async function clearEntries(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ── Internal ─────────────────────────────────────────────────────────────────

/**
 * Persist all entries to storage.
 */
async function saveEntries(entries: JournalEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

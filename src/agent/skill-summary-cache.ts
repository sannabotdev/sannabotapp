/**
 * SkillSummaryCache – Caches LLM-generated skill summaries with hash-based invalidation
 *
 * Stores summaries in AsyncStorage with format:
 *   skill_summary_<skillName> → JSON({ summary, contentHash, generatedAt })
 *
 * When a skill's content changes (hash mismatch), the summary is regenerated.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUMMARY_KEY_PREFIX = 'skill_summary_';

interface CachedSummary {
  summary: string;
  contentHash: string;
  generatedAt: number;
}

/**
 * Compute a simple hash of the skill content for change detection.
 * Uses a simple string hash function compatible with React Native.
 */
function computeContentHash(content: string): string {
  // Simple hash function for React Native (crypto.createHash not available)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export class SkillSummaryCache {
  private static key(skillName: string): string {
    return `${SUMMARY_KEY_PREFIX}${skillName}`;
  }

  /**
   * Get cached summary if it exists and matches the current content hash.
   * Returns null if cache miss or hash mismatch.
   */
  static async getCachedSummary(
    skillName: string,
    currentContentHash: string,
  ): Promise<string | null> {
    try {
      const key = SkillSummaryCache.key(skillName);
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const data: CachedSummary = JSON.parse(cached);
      if (data.contentHash !== currentContentHash) {
        // Hash mismatch - content changed, cache invalid
        return null;
      }

      return data.summary;
    } catch {
      return null;
    }
  }

  /**
   * Store a generated summary with its content hash.
   */
  static async storeSummary(
    skillName: string,
    summary: string,
    contentHash: string,
  ): Promise<void> {
    try {
      const key = SkillSummaryCache.key(skillName);
      const data: CachedSummary = {
        summary,
        contentHash,
        generatedAt: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      // Non-critical - cache write failures don't break functionality
      console.warn(`[SkillSummaryCache] Failed to store summary for ${skillName}:`, err);
    }
  }

  /**
   * Compute hash for skill content.
   */
  static computeHash(content: string): string {
    return computeContentHash(content);
  }

  /**
   * Clear cached summary for a skill (e.g., when skill is deleted).
   */
  static async clearSummary(skillName: string): Promise<void> {
    try {
      const key = SkillSummaryCache.key(skillName);
      await AsyncStorage.removeItem(key);
    } catch {
      // Non-critical
    }
  }

  /**
   * Get the raw cached summary for viewing (without hash validation).
   * Returns the summary text if it exists, null otherwise.
   */
  static async getRawSummary(skillName: string): Promise<string | null> {
    try {
      const key = SkillSummaryCache.key(skillName);
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const data: CachedSummary = JSON.parse(cached);
      return data.summary;
    } catch {
      return null;
    }
  }

  /**
   * Clear all cached summaries.
   */
  static async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const summaryKeys = allKeys.filter(k => k.startsWith(SUMMARY_KEY_PREFIX));
      if (summaryKeys.length > 0) {
        await AsyncStorage.multiRemove(summaryKeys);
      }
    } catch {
      // Non-critical
    }
  }
}

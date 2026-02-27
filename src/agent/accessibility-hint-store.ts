/**
 * AccessibilityHintStore – Persists LLM-condensed UI interaction hints per app.
 *
 * After each successful or failed accessibility automation run, the LLM condenses
 * the full interaction history (accessibility trees + actions) into a few paragraphs
 * of natural-language hints. These hints are stored here and injected into the
 * system prompt of future automation runs for the same app.
 *
 * Key: `accessibility_hint_<sanitised_packageName>`
 * Value: A plain text string of condensed hints (LLM-generated, no Node IDs).
 *
 * Design: one string per package – the LLM always re-condenses everything, so we
 * simply overwrite on every run. No versioning needed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const HINT_KEY_PREFIX = 'accessibility_hint_';

export class AccessibilityHintStore {
  /** Build the AsyncStorage key for a given package name. */
  private static key(packageName: string): string {
    // Replace dots with underscores to keep the key safe (e.g. com.whatsapp → com_whatsapp)
    return `${HINT_KEY_PREFIX}${packageName.replace(/\./g, '_')}`;
  }

  /**
   * Load condensed hints for a given app.
   * Returns an empty string if no hints are stored yet.
   */
  static async getHints(packageName: string): Promise<string> {
    try {
      const value = await AsyncStorage.getItem(AccessibilityHintStore.key(packageName));
      return value ?? '';
    } catch {
      return '';
    }
  }

  /**
   * Save condensed hints for a given app.
   * Overwrites any previously stored hints (the LLM always re-condenses everything).
   */
  static async saveHints(packageName: string, condensedHints: string): Promise<void> {
    await AsyncStorage.setItem(AccessibilityHintStore.key(packageName), condensedHints);
  }

  /**
   * Delete all stored hints for a given app.
   */
  static async clearHints(packageName: string): Promise<void> {
    await AsyncStorage.removeItem(AccessibilityHintStore.key(packageName));
  }
}

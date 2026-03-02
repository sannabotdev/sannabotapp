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
import type { LLMProvider, Message } from '../llm/types';
import { DebugLogger } from './debug-logger';

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

  /**
   * Condense a user-provided hint with existing learned hints.
   * The user hint has higher priority and can override existing hints.
   *
   * @param packageName Android package name (e.g. "com.whatsapp")
   * @param userHint User-provided hint text
   * @param provider LLM provider for condensing
   * @returns Promise that resolves when condensing is complete
   */
  static async condenseWithUserHint(
    packageName: string,
    userHint: string,
    provider: LLMProvider,
  ): Promise<void> {
    try {
      // Load existing hints (empty string if none)
      const existingHints = await AccessibilityHintStore.getHints(packageName);

      const systemPrompt =
        `You are condensing accessibility interaction hints for the Android app "${packageName}". ` +
        `Your goal is to create compact, reusable hints that help future automation runs of the same app. ` +
        `You are integrating a user-provided hint with existing learned hints. ` +
        `The user-provided hint has HIGHER PRIORITY than existing hints and can override or replace them.`;

      const userPrompt =
        (existingHints
          ? `Existing learned hints:\n${existingHints}\n\n`
          : 'No existing hints found.\n\n') +
        `User-provided hint (HIGH PRIORITY - can override existing hints):\n${userHint}\n\n` +
        `IMPORTANT:\n` +
        `- The user-provided hint has HIGHER PRIORITY than existing hints\n` +
        `- If the user hint contradicts existing hints, the user hint takes precedence\n` +
        `- Integrate the user hint with existing hints into 3-4 concise paragraphs\n` +
        `- Keep the most important information from both sources\n` +
        `- Remove redundant or outdated information\n` +
        `- DO NOT use node IDs (like "node_5") in your description\n` +
        `- Clearly mark SUCCESSFUL flows: "✅ To achieve X: navigate to home screen, then click 'Y'..."\n` +
        `- Clearly mark FAILED flows: "❌ Attempting X via Y did NOT work because..."\n` +
        `- Describe flows in natural language using button labels and visible UI text\n\n` +
        `Condensed hints:`;

      const condenseMessages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      DebugLogger.logLLMRequest(provider.getCurrentModel(), condenseMessages.length, 0, condenseMessages);

      const response = await provider.chat(condenseMessages, []);

      DebugLogger.logLLMResponse(response.content, [], response.usage, response);

      const condensedHints = response.content?.trim();
      if (condensedHints) {
        await AccessibilityHintStore.saveHints(packageName, condensedHints);
        DebugLogger.add(
          'info',
          'AccessibilityHints',
          `User hint condensed and saved for ${packageName} (${condensedHints.length} chars)`,
          condensedHints,
        );
        console.log(
          `[AccessibilityHintStore] User hint condensed and saved for ${packageName} (${condensedHints.length} chars)`,
        );
      } else {
        throw new Error('LLM returned empty condensed hints');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AccessibilityHintStore] Failed to condense user hint for ${packageName}:`, msg);
      DebugLogger.add(
        'error',
        'AccessibilityHints',
        `Failed to condense user hint for ${packageName}: ${msg}`,
      );
      throw err;
    }
  }
}

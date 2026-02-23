/**
 * DynamicSkillStore – Persists user-uploaded SKILL.md files in AsyncStorage.
 *
 * Key convention: `dynamic_skill_<skillName>`
 * This prefix is used in backup_rules.xml to selectively include these keys
 * in Google Auto Backup, ensuring skills survive app reinstallation.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SKILL_KEY_PREFIX = 'dynamic_skill_';

export class DynamicSkillStore {
  /** Build the AsyncStorage key for a given skill name */
  private static key(name: string): string {
    return `${SKILL_KEY_PREFIX}${name}`;
  }

  /** Persist a skill's raw SKILL.md content */
  async saveSkill(name: string, content: string): Promise<void> {
    await AsyncStorage.setItem(DynamicSkillStore.key(name), content);
  }

  /** Load a single skill's content by name. Returns null if not found. */
  async loadSkill(name: string): Promise<string | null> {
    return AsyncStorage.getItem(DynamicSkillStore.key(name));
  }

  /** Load all dynamically stored skills. Returns a map of name → content. */
  async loadAllSkills(): Promise<Record<string, string>> {
    const allKeys = await AsyncStorage.getAllKeys();
    const skillKeys = allKeys.filter(k => k.startsWith(SKILL_KEY_PREFIX));

    if (skillKeys.length === 0) {
      return {};
    }

    const pairs = await AsyncStorage.multiGet(skillKeys);
    const result: Record<string, string> = {};

    for (const [key, value] of pairs) {
      if (value !== null) {
        const skillName = key.slice(SKILL_KEY_PREFIX.length);
        result[skillName] = value;
      }
    }

    return result;
  }

  /** Delete a skill from AsyncStorage */
  async deleteSkill(name: string): Promise<void> {
    await AsyncStorage.removeItem(DynamicSkillStore.key(name));
  }

  /** Get names of all stored dynamic skills */
  async getSkillNames(): Promise<string[]> {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys
      .filter(k => k.startsWith(SKILL_KEY_PREFIX))
      .map(k => k.slice(SKILL_KEY_PREFIX.length));
  }

  /** Check whether a skill with the given name already exists */
  async hasSkill(name: string): Promise<boolean> {
    const value = await AsyncStorage.getItem(DynamicSkillStore.key(name));
    return value !== null;
  }
}

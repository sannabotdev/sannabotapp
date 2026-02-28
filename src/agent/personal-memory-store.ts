import AsyncStorage from '@react-native-async-storage/async-storage';

const PERSONAL_MEMORY_KEY = 'personal_memory_md';

export class PersonalMemoryStore {
  static async getMemory(): Promise<string> {
    try {
      const value = await AsyncStorage.getItem(PERSONAL_MEMORY_KEY);
      return value ?? '';
    } catch {
      return '';
    }
  }

  static async saveMemory(text: string): Promise<void> {
    await AsyncStorage.setItem(PERSONAL_MEMORY_KEY, text);
  }

  static async clearMemory(): Promise<void> {
    await AsyncStorage.removeItem(PERSONAL_MEMORY_KEY);
  }
}

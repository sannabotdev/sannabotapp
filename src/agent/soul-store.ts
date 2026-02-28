import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUL_KEY = 'soul_md';

export class SoulStore {
  static async getSoul(): Promise<string> {
    try {
      const value = await AsyncStorage.getItem(SOUL_KEY);
      return value ?? '';
    } catch {
      return '';
    }
  }

  static async saveSoul(text: string): Promise<void> {
    await AsyncStorage.setItem(SOUL_KEY, text);
  }

  static async clearSoul(): Promise<void> {
    await AsyncStorage.removeItem(SOUL_KEY);
  }
}

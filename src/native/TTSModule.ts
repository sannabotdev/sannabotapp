/**
 * TypeScript bridge for TTSModule native module
 */
import { NativeModules, NativeEventEmitter } from 'react-native';

const { TTSModule } = NativeModules;

export interface TTSModuleType {
  speak(text: string, language: string | null, utteranceId: string | null): Promise<string>;
  stop(): Promise<string>;
  isSpeaking(): Promise<boolean>;
  setSpeechRate(rate: number): Promise<string>;
}

export const TTSEvents = new NativeEventEmitter(TTSModule);

export default TTSModule as TTSModuleType;

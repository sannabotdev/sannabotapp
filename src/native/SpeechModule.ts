/**
 * TypeScript bridge for SpeechModule native module (replaces @react-native-voice/voice)
 */
import { NativeModules, NativeEventEmitter } from 'react-native';

const { SpeechModule } = NativeModules;

export interface SpeechModuleType {
  startListening(language: string, mode: string): Promise<string>;
  stopListening(): Promise<string>;
  cancel(): Promise<string>;
  isAvailable(): Promise<boolean>;
  isListening(): Promise<boolean>;
}

export const SpeechEvents = new NativeEventEmitter(SpeechModule);

export default SpeechModule as SpeechModuleType;

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
  /**
   * Play a beep / alert tone.
   * @param toneType  Android ToneGenerator constant (24=BEEP, 25=ACK, 27=PROMPT)
   * @param durationMs  Tone duration in ms
   * @param count  Number of beeps (max 10)
   */
  playBeep(toneType: number, durationMs: number, count: number): Promise<string>;
}

export const TTSEvents = new NativeEventEmitter(TTSModule);

export default TTSModule as TTSModuleType;

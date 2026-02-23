/**
 * TypeScript bridge for AudioRecorderModule native module
 */
import { NativeModules, NativeEventEmitter } from 'react-native';

const { AudioRecorderModule } = NativeModules;

export interface AudioRecorderModuleType {
  startRecording(): Promise<string>;
  stopRecording(): Promise<string>;
  isRecording(): Promise<boolean>;
}

export const AudioRecorderEvents = new NativeEventEmitter(AudioRecorderModule);

export default AudioRecorderModule as AudioRecorderModuleType;

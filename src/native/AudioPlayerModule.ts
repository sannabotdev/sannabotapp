/**
 * TypeScript bridge for AudioPlayerModule native module
 */
import { NativeModules, NativeEventEmitter } from 'react-native';

const { AudioPlayerModule } = NativeModules;

export interface AudioStatus {
  status: 'playing' | 'paused' | 'stopped';
  url: string | null;
  position: number; // in seconds
  duration: number; // in seconds
}

export interface AudioPlayerModuleType {
  play(url: string): Promise<string>;
  pause(): Promise<number>; // returns position in seconds
  resume(): Promise<string>;
  stop(): Promise<string>;
  seek(positionSeconds: number, isRelative: boolean): Promise<number>; // returns new position in seconds
  getStatus(): Promise<AudioStatus>;
}

export const AudioPlayerEvents = new NativeEventEmitter(AudioPlayerModule);

export default AudioPlayerModule as AudioPlayerModuleType;

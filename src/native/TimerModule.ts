/**
 * TypeScript bridge for TimerModule native module
 *
 * Manages countdown timers and stopwatches.
 * Uses Android AlarmManager for countdown timers and SharedPreferences for persistence.
 */
import { NativeModules } from 'react-native';

const { TimerModule } = NativeModules;

export interface TimerModuleType {
  /** Save/update a timer and set its alarm (for countdown timers). timerJson = full Timer JSON. */
  setTimer(timerJson: string): Promise<string>;

  /** Remove a timer completely (cancel alarm + delete). */
  removeTimer(id: string): Promise<string>;

  /** Get a single timer by ID. Returns JSON string or null. */
  getTimer(id: string): Promise<string | null>;

  /** List all timers. Returns JSON array string. */
  getAllTimers(): Promise<string>;

  /** Get elapsed time for a stopwatch in milliseconds. Returns 0 if timer not found or not a stopwatch. */
  getElapsedTime(id: string): Promise<number>;
}

export default TimerModule as TimerModuleType;

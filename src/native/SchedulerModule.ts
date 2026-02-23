/**
 * TypeScript bridge for SchedulerModule native module
 *
 * Full CRUD for scheduled sub-agent executions.
 * Uses Android AlarmManager + HeadlessJS for background execution.
 */
import { NativeModules } from 'react-native';

const { SchedulerModule } = NativeModules;

export interface SchedulerModuleType {
  /** Save/update a schedule and set its alarm. scheduleJson = full Schedule JSON. */
  setSchedule(scheduleJson: string): Promise<string>;

  /** Remove a schedule completely (cancel alarm + delete). */
  removeSchedule(id: string): Promise<string>;

  /** Get a single schedule by ID. Returns JSON string or null. */
  getSchedule(id: string): Promise<string | null>;

  /** List all schedules. Returns JSON array string. */
  getAllSchedules(): Promise<string>;

  /** Update the next trigger time (for recurring schedules). */
  updateTrigger(id: string, newTriggerAtMs: number): Promise<string>;

  /** Record that a schedule was executed. */
  markExecuted(id: string): Promise<string>;

  /** Save agent config for headless sub-agent. */
  saveAgentConfig(configJson: string): Promise<string>;

  /** Get saved agent config. Returns JSON string or null. */
  getAgentConfig(): Promise<string | null>;
}

export default SchedulerModule as SchedulerModuleType;

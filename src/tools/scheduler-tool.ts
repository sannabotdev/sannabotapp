/**
 * SchedulerTool – Create, manage, and execute scheduled sub-agent tasks
 *
 * Instead of fixed actions, each schedule stores a natural language instruction
 * that a sub-agent (mini ConversationPipeline) executes at the scheduled time.
 *
 * Supports:
 *   - One-time and recurring schedules (interval, daily, weekly)
 *   - Full CRUD: create, list, update, delete, enable/disable
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import SchedulerModule from '../native/SchedulerModule';

// ── Data Model ──────────────────────────────────────────────────────────────

export interface ScheduleRecurrence {
  /** 'once' = single execution, 'interval' = every X ms, 'daily' = every day, 'weekly' = specific days */
  type: 'once' | 'interval' | 'daily' | 'weekly';
  /** For 'interval': repeat interval in milliseconds */
  intervalMs?: number;
  /** For 'daily'/'weekly': time of day as "HH:mm" (24h format, Europe/Vienna) */
  time?: string;
  /** For 'weekly': days of week (1=Mon, 2=Tue, ..., 7=Sun) */
  daysOfWeek?: number[];
}

export interface Schedule {
  id: string;
  /** Natural language instruction for the sub-agent */
  instruction: string;
  /** Next execution time (epoch ms) */
  triggerAtMs: number;
  /** Whether this schedule is active */
  enabled: boolean;
  /** Recurrence configuration */
  recurrence: ScheduleRecurrence;
  /** When this schedule was created (epoch ms) */
  createdAt: number;
  /** Last successful execution time (epoch ms), or null */
  lastExecutedAt: number | null;
}

type SchedulerAction = 'create' | 'list' | 'get' | 'update' | 'delete' | 'enable' | 'disable';

// ── Tool ─────────────────────────────────────────────────────────────────────

export class SchedulerTool implements Tool {
  name(): string {
    return 'scheduler';
  }

  description(): string {
    return [
      'Schedule and manage time-based tasks.',
      'Each scheduled task is executed at the specified time by a sub-agent (mini AI)',
      'that can use any available tools (send SMS, HTTP requests, TTS, etc.).',
      'Supports one-time and recurring schedules (interval, daily, weekly).',
      'Actions: create, list, get, update, delete, enable, disable.',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'list', 'get', 'update', 'delete', 'enable', 'disable'],
          description: 'Action: create, list (show all), get (single), update, delete, enable, disable',
        },
        schedule_id: {
          type: 'string',
          description: 'Schedule ID (required for get/update/delete/enable/disable)',
        },
        instruction: {
          type: 'string',
          description: 'Natural language instruction for the sub-agent. E.g. "Send an SMS to +4366012345678 with the text: On my way"',
        },
        trigger_at_ms: {
          type: 'number',
          description: 'Next execution time as Unix timestamp in milliseconds',
        },
        recurrence_type: {
          type: 'string',
          enum: ['once', 'interval', 'daily', 'weekly'],
          description: 'Recurrence type: once (single), interval (every X ms), daily, weekly',
        },
        recurrence_interval_ms: {
          type: 'number',
          description: 'For interval: repeat interval in milliseconds',
        },
        recurrence_time: {
          type: 'string',
          description: 'For daily/weekly: time of day as "HH:mm" (24h, e.g. "14:00")',
        },
        recurrence_days_of_week: {
          type: 'array',
          items: { type: 'number' },
          description: 'For weekly: days of week (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun)',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as SchedulerAction;

    switch (action) {
      case 'create':
        return this.createSchedule(args);
      case 'list':
        return this.listSchedules();
      case 'get':
        return this.getSchedule(args);
      case 'update':
        return this.updateSchedule(args);
      case 'delete':
        return this.deleteSchedule(args);
      case 'enable':
        return this.toggleSchedule(args, true);
      case 'disable':
        return this.toggleSchedule(args, false);
      default:
        return errorResult(`Unknown action: ${action}`);
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────

  private async createSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const instruction = args.instruction as string;
    const triggerAtMs = args.trigger_at_ms as number;
    const recurrenceType = (args.recurrence_type as ScheduleRecurrence['type']) ?? 'once';

    if (!instruction) {
      return errorResult('Missing instruction parameter – what should the sub-agent do?');
    }
    if (!triggerAtMs) {
      return errorResult('Missing trigger_at_ms parameter – when should it be executed?');
    }

    const now = Date.now();
    if (triggerAtMs <= now) {
      return errorResult(
        `Trigger time is in the past. Current: ${now}, Provided: ${triggerAtMs}`,
      );
    }

    const recurrence: ScheduleRecurrence = {
      type: recurrenceType,
    };

    if (recurrenceType === 'interval') {
      const intervalMs = args.recurrence_interval_ms as number;
      if (!intervalMs || intervalMs < 60_000) {
        return errorResult('recurrence_interval_ms missing or too small (min. 60000 ms = 1 minute)');
      }
      recurrence.intervalMs = intervalMs;
    }

    if (recurrenceType === 'daily' || recurrenceType === 'weekly') {
      const time = args.recurrence_time as string;
      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return errorResult('recurrence_time missing or invalid format (expected: "HH:mm")');
      }
      recurrence.time = time;
    }

    if (recurrenceType === 'weekly') {
      const days = args.recurrence_days_of_week as number[];
      if (!days || days.length === 0) {
        return errorResult('recurrence_days_of_week missing (e.g. [1,3,5] for Mon/Wed/Fri)');
      }
      recurrence.daysOfWeek = days;
    }

    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const schedule: Schedule = {
      id,
      instruction,
      triggerAtMs,
      enabled: true,
      recurrence,
      createdAt: now,
      lastExecutedAt: null,
    };

    try {
      await SchedulerModule.setSchedule(JSON.stringify(schedule));
      return successResult(
        `Schedule created: ${this.formatScheduleDetail(schedule)}`,
        `Schedule created: ${this.formatScheduleShort(schedule)}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to create schedule: ${errMsg}`);
    }
  }

  // ── List ────────────────────────────────────────────────────────────────

  private async listSchedules(): Promise<ToolResult> {
    try {
      const json = await SchedulerModule.getAllSchedules();
      const schedules = JSON.parse(json) as Schedule[];

      if (schedules.length === 0) {
        return successResult(
          'No schedules found.',
          'You have no scheduled tasks',
        );
      }

      const lines = schedules.map(s => this.formatScheduleListItem(s));
      return successResult(
        `${schedules.length} schedule(s):\n${lines.join('\n')}`,
        `You have ${schedules.length} scheduled task(s)`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to list schedules: ${errMsg}`);
    }
  }

  // ── Get ─────────────────────────────────────────────────────────────────

  private async getSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('Missing schedule_id parameter');
    }

    try {
      const json = await SchedulerModule.getSchedule(id);
      if (!json) {
        return errorResult(`Schedule "${id}" not found`);
      }
      const schedule = JSON.parse(json) as Schedule;
      return successResult(this.formatScheduleDetail(schedule));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to get schedule: ${errMsg}`);
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────

  private async updateSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('Missing schedule_id parameter');
    }

    try {
      const json = await SchedulerModule.getSchedule(id);
      if (!json) {
        return errorResult(`Schedule "${id}" not found`);
      }
      const schedule = JSON.parse(json) as Schedule;

      // Apply updates
      if (args.instruction !== undefined) {
        schedule.instruction = args.instruction as string;
      }
      if (args.trigger_at_ms !== undefined) {
        schedule.triggerAtMs = args.trigger_at_ms as number;
      }
      if (args.recurrence_type !== undefined) {
        schedule.recurrence.type = args.recurrence_type as ScheduleRecurrence['type'];
      }
      if (args.recurrence_interval_ms !== undefined) {
        schedule.recurrence.intervalMs = args.recurrence_interval_ms as number;
      }
      if (args.recurrence_time !== undefined) {
        schedule.recurrence.time = args.recurrence_time as string;
      }
      if (args.recurrence_days_of_week !== undefined) {
        schedule.recurrence.daysOfWeek = args.recurrence_days_of_week as number[];
      }

      await SchedulerModule.setSchedule(JSON.stringify(schedule));
      return successResult(
        `Schedule updated: ${this.formatScheduleDetail(schedule)}`,
        'Schedule updated',
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to update schedule: ${errMsg}`);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  private async deleteSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('Missing schedule_id parameter');
    }

    try {
      await SchedulerModule.removeSchedule(id);
      return successResult(
        `Schedule "${id}" deleted.`,
        'Schedule deleted',
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to delete schedule: ${errMsg}`);
    }
  }

  // ── Enable / Disable ───────────────────────────────────────────────────

  private async toggleSchedule(args: Record<string, unknown>, enabled: boolean): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('Missing schedule_id parameter');
    }

    try {
      const json = await SchedulerModule.getSchedule(id);
      if (!json) {
        return errorResult(`Schedule "${id}" not found`);
      }
      const schedule = JSON.parse(json) as Schedule;
      schedule.enabled = enabled;

      await SchedulerModule.setSchedule(JSON.stringify(schedule));
      const label = enabled ? 'enabled' : 'disabled';
      return successResult(
        `Schedule "${id}" ${label}.`,
        `Schedule ${label}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to ${enabled ? 'enable' : 'disable'} schedule: ${errMsg}`);
    }
  }

  // ── Formatting Helpers ─────────────────────────────────────────────────

  private formatScheduleDetail(s: Schedule): string {
    const lines: string[] = [
      `ID: ${s.id}`,
      `Instruction: "${s.instruction}"`,
      `Next execution: ${this.formatDate(s.triggerAtMs)}`,
      `Status: ${s.enabled ? '✅ Active' : '⏸️ Disabled'}`,
      `Recurrence: ${this.formatRecurrence(s.recurrence)}`,
      `Created: ${this.formatDate(s.createdAt)}`,
    ];
    if (s.lastExecutedAt) {
      lines.push(`Last executed: ${this.formatDate(s.lastExecutedAt)}`);
    }
    return lines.join('\n');
  }

  private formatScheduleShort(s: Schedule): string {
    const time = new Date(s.triggerAtMs).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const recurrence = s.recurrence.type === 'once' ? 'one-time' : this.formatRecurrence(s.recurrence);
    return `"${s.instruction}" at ${time} (${recurrence})`;
  }

  private formatScheduleListItem(s: Schedule): string {
    const status = s.enabled ? '✅' : '⏸️';
    const time = this.formatDate(s.triggerAtMs);
    const rec = this.formatRecurrence(s.recurrence);
    return `${status} [${s.id}] "${s.instruction}" – ${time} (${rec})`;
  }

  private formatRecurrence(r: ScheduleRecurrence): string {
    switch (r.type) {
      case 'once':
        return 'one-time';
      case 'interval': {
        const minutes = Math.round((r.intervalMs ?? 0) / 60_000);
        if (minutes < 60) return `every ${minutes} minutes`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `every ${hours}h ${mins}min` : `every ${hours} hours`;
      }
      case 'daily':
        return `daily at ${r.time ?? '?'}`;
      case 'weekly': {
        const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const days = (r.daysOfWeek ?? []).map(d => dayNames[d] ?? '?').join(', ');
        return `weekly ${days} at ${r.time ?? '?'}`;
      }
      default:
        return r.type;
    }
  }

  private formatDate(ms: number): string {
    const d = new Date(ms);
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${date} ${time}`;
  }
}

// ── Recurrence Helpers (exported for use in scheduler-headless.ts) ────────

/**
 * Calculate the next trigger time for a recurring schedule after execution.
 * Returns null for 'once' schedules (they should be deleted after execution).
 */
export function calculateNextTrigger(schedule: Schedule): number | null {
  const { recurrence } = schedule;
  const now = Date.now();

  switch (recurrence.type) {
    case 'once':
      return null;

    case 'interval': {
      const interval = recurrence.intervalMs ?? 60_000;
      // Next trigger = now + interval (not from the original trigger, to avoid drift pile-up)
      return now + interval;
    }

    case 'daily': {
      if (!recurrence.time) return null;
      return getNextDailyTrigger(recurrence.time, now);
    }

    case 'weekly': {
      if (!recurrence.time || !recurrence.daysOfWeek?.length) return null;
      return getNextWeeklyTrigger(recurrence.time, recurrence.daysOfWeek, now);
    }

    default:
      return null;
  }
}

/**
 * Get the next occurrence of a daily time (HH:mm) after `after` timestamp.
 */
function getNextDailyTrigger(time: string, after: number): number {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(after);
  next.setHours(hours, minutes, 0, 0);

  // If this time today has already passed, schedule for tomorrow
  if (next.getTime() <= after) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

/**
 * Get the next occurrence of a weekly schedule after `after` timestamp.
 * daysOfWeek: 1=Mon, 2=Tue, ..., 7=Sun
 */
function getNextWeeklyTrigger(time: string, daysOfWeek: number[], after: number): number {
  const [hours, minutes] = time.split(':').map(Number);

  // Try the next 8 days to find the next matching day
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + daysAhead);
    candidate.setHours(hours, minutes, 0, 0);

    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat → convert to our 1=Mon, ..., 7=Sun
    const jsDay = candidate.getDay();
    const ourDay = jsDay === 0 ? 7 : jsDay;

    if (daysOfWeek.includes(ourDay) && candidate.getTime() > after) {
      return candidate.getTime();
    }
  }

  // Fallback: 7 days from now
  return after + 7 * 24 * 60 * 60 * 1000;
}

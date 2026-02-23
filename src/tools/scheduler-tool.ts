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
      'Zeitgesteuerte Aufgaben planen und verwalten.',
      'Jede geplante Aufgabe wird zu dem Zeitpunkt von einem Sub-Agenten (Mini-KI) ausgeführt,',
      'der beliebige Tools (SMS senden, HTTP-Anfragen, TTS, etc.) nutzen kann.',
      'Unterstützt einmalige und wiederkehrende Zeitpläne (Intervall, täglich, wöchentlich).',
      'Aktionen: create, list, get, update, delete, enable, disable.',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'list', 'get', 'update', 'delete', 'enable', 'disable'],
          description: 'Aktion: create (erstellen), list (alle anzeigen), get (einzeln), update (ändern), delete (löschen), enable (aktivieren), disable (deaktivieren)',
        },
        schedule_id: {
          type: 'string',
          description: 'Schedule-ID (für get/update/delete/enable/disable)',
        },
        instruction: {
          type: 'string',
          description: 'Natürlichsprachliche Anweisung für den Sub-Agenten. Z.B. "Sende eine SMS an +4366012345678 mit dem Text: Bin unterwegs"',
        },
        trigger_at_ms: {
          type: 'number',
          description: 'Nächster Ausführungszeitpunkt als Unix-Timestamp in Millisekunden',
        },
        recurrence_type: {
          type: 'string',
          enum: ['once', 'interval', 'daily', 'weekly'],
          description: 'Wiederholungstyp: once (einmalig), interval (alle X ms), daily (täglich), weekly (wöchentlich)',
        },
        recurrence_interval_ms: {
          type: 'number',
          description: 'Für interval: Wiederholungsintervall in Millisekunden',
        },
        recurrence_time: {
          type: 'string',
          description: 'Für daily/weekly: Uhrzeit als "HH:mm" (24h, z.B. "14:00")',
        },
        recurrence_days_of_week: {
          type: 'array',
          items: { type: 'number' },
          description: 'Für weekly: Wochentage (1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa, 7=So)',
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
        return errorResult(`Unbekannte Aktion: ${action}`);
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────

  private async createSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const instruction = args.instruction as string;
    const triggerAtMs = args.trigger_at_ms as number;
    const recurrenceType = (args.recurrence_type as ScheduleRecurrence['type']) ?? 'once';

    if (!instruction) {
      return errorResult('instruction Parameter fehlt – was soll der Sub-Agent tun?');
    }
    if (!triggerAtMs) {
      return errorResult('trigger_at_ms Parameter fehlt – wann soll es ausgeführt werden?');
    }

    const now = Date.now();
    if (triggerAtMs <= now) {
      return errorResult(
        `Zeitpunkt liegt in der Vergangenheit. Aktuell: ${now}, Angegeben: ${triggerAtMs}`,
      );
    }

    const recurrence: ScheduleRecurrence = {
      type: recurrenceType,
    };

    if (recurrenceType === 'interval') {
      const intervalMs = args.recurrence_interval_ms as number;
      if (!intervalMs || intervalMs < 60_000) {
        return errorResult('recurrence_interval_ms fehlt oder zu klein (min. 60000 ms = 1 Minute)');
      }
      recurrence.intervalMs = intervalMs;
    }

    if (recurrenceType === 'daily' || recurrenceType === 'weekly') {
      const time = args.recurrence_time as string;
      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return errorResult('recurrence_time fehlt oder ungültiges Format (erwartet: "HH:mm")');
      }
      recurrence.time = time;
    }

    if (recurrenceType === 'weekly') {
      const days = args.recurrence_days_of_week as number[];
      if (!days || days.length === 0) {
        return errorResult('recurrence_days_of_week fehlt (z.B. [1,3,5] für Mo/Mi/Fr)');
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
        `Zeitplan erstellt: ${this.formatScheduleDetail(schedule)}`,
        `Zeitplan erstellt: ${this.formatScheduleShort(schedule)}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Erstellen fehlgeschlagen: ${errMsg}`);
    }
  }

  // ── List ────────────────────────────────────────────────────────────────

  private async listSchedules(): Promise<ToolResult> {
    try {
      const json = await SchedulerModule.getAllSchedules();
      const schedules = JSON.parse(json) as Schedule[];

      if (schedules.length === 0) {
        return successResult(
          'Keine Zeitpläne vorhanden.',
          'Du hast keine geplanten Aufgaben',
        );
      }

      const lines = schedules.map(s => this.formatScheduleListItem(s));
      return successResult(
        `${schedules.length} Zeitplan/Zeitpläne:\n${lines.join('\n')}`,
        `Du hast ${schedules.length} geplante Aufgaben`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Auflisten fehlgeschlagen: ${errMsg}`);
    }
  }

  // ── Get ─────────────────────────────────────────────────────────────────

  private async getSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('schedule_id Parameter fehlt');
    }

    try {
      const json = await SchedulerModule.getSchedule(id);
      if (!json) {
        return errorResult(`Zeitplan "${id}" nicht gefunden`);
      }
      const schedule = JSON.parse(json) as Schedule;
      return successResult(this.formatScheduleDetail(schedule));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Abrufen fehlgeschlagen: ${errMsg}`);
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────

  private async updateSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('schedule_id Parameter fehlt');
    }

    try {
      const json = await SchedulerModule.getSchedule(id);
      if (!json) {
        return errorResult(`Zeitplan "${id}" nicht gefunden`);
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
        `Zeitplan aktualisiert: ${this.formatScheduleDetail(schedule)}`,
        'Zeitplan aktualisiert',
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Aktualisieren fehlgeschlagen: ${errMsg}`);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  private async deleteSchedule(args: Record<string, unknown>): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('schedule_id Parameter fehlt');
    }

    try {
      await SchedulerModule.removeSchedule(id);
      return successResult(
        `Zeitplan "${id}" gelöscht.`,
        'Zeitplan gelöscht',
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Löschen fehlgeschlagen: ${errMsg}`);
    }
  }

  // ── Enable / Disable ───────────────────────────────────────────────────

  private async toggleSchedule(args: Record<string, unknown>, enabled: boolean): Promise<ToolResult> {
    const id = args.schedule_id as string;
    if (!id) {
      return errorResult('schedule_id Parameter fehlt');
    }

    try {
      const json = await SchedulerModule.getSchedule(id);
      if (!json) {
        return errorResult(`Zeitplan "${id}" nicht gefunden`);
      }
      const schedule = JSON.parse(json) as Schedule;
      schedule.enabled = enabled;

      await SchedulerModule.setSchedule(JSON.stringify(schedule));
      const label = enabled ? 'aktiviert' : 'deaktiviert';
      return successResult(
        `Zeitplan "${id}" ${label}.`,
        `Zeitplan ${label}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`${enabled ? 'Aktivieren' : 'Deaktivieren'} fehlgeschlagen: ${errMsg}`);
    }
  }

  // ── Formatting Helpers ─────────────────────────────────────────────────

  private formatScheduleDetail(s: Schedule): string {
    const lines: string[] = [
      `ID: ${s.id}`,
      `Anweisung: "${s.instruction}"`,
      `Nächste Ausführung: ${this.formatDate(s.triggerAtMs)}`,
      `Status: ${s.enabled ? '✅ Aktiv' : '⏸️ Deaktiviert'}`,
      `Wiederholung: ${this.formatRecurrence(s.recurrence)}`,
      `Erstellt: ${this.formatDate(s.createdAt)}`,
    ];
    if (s.lastExecutedAt) {
      lines.push(`Letzte Ausführung: ${this.formatDate(s.lastExecutedAt)}`);
    }
    return lines.join('\n');
  }

  private formatScheduleShort(s: Schedule): string {
    const time = new Date(s.triggerAtMs).toLocaleTimeString('de-AT', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const recurrence = s.recurrence.type === 'once' ? 'einmalig' : this.formatRecurrence(s.recurrence);
    return `"${s.instruction}" um ${time} (${recurrence})`;
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
        return 'einmalig';
      case 'interval': {
        const minutes = Math.round((r.intervalMs ?? 0) / 60_000);
        if (minutes < 60) return `alle ${minutes} Minuten`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `alle ${hours}h ${mins}min` : `alle ${hours} Stunden`;
      }
      case 'daily':
        return `täglich um ${r.time ?? '?'}`;
      case 'weekly': {
        const dayNames = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        const days = (r.daysOfWeek ?? []).map(d => dayNames[d] ?? '?').join(', ');
        return `wöchentlich ${days} um ${r.time ?? '?'}`;
      }
      default:
        return r.type;
    }
  }

  private formatDate(ms: number): string {
    const d = new Date(ms);
    const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
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

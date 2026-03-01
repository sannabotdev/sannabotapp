/**
 * TimerTool – Manage countdown timers and stopwatches
 *
 * Supports multiple parallel timers and stopwatches.
 * Countdown timers beep when they expire and are automatically removed.
 * Stopwatches can be queried for elapsed time and stopped (then removed).
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import TimerModule from '../native/TimerModule';

// ── Data Model ──────────────────────────────────────────────────────────────

export interface Timer {
  id: string;
  label?: string;
  type: 'timer' | 'stopwatch';
  startTimeMs: number;
  durationMs?: number; // Only for type='timer'
  enabled: boolean;
  createdAt: number;
}

type TimerAction = 'start_timer' | 'start_stopwatch' | 'list' | 'get_status' | 'stop' | 'cancel';

// ── Tool ─────────────────────────────────────────────────────────────────────

export class TimerTool implements Tool {
  name(): string {
    return 'timer';
  }

  description(): string {
    return [
      'Manage countdown timers and stopwatches for short durations (seconds to minutes).',
      'Use this tool when the user asks for a timer (especially "egg timer" or durations in seconds).',
      'Countdown timers beep when they expire and are automatically removed.',
      'Stopwatches can be queried for elapsed time and stopped (then removed).',
      'Multiple timers and stopwatches can run in parallel.',
      'Actions: start_timer (duration_ms in milliseconds), start_stopwatch, list, get_status, stop, cancel.',
      'IMPORTANT: Timer IDs are internal – NEVER show them to the user.',
      'When reporting timers to the user, describe them by their label and time.',
      'DO NOT use the scheduler tool for simple timers – use this timer tool instead.',
      'For time calculations, use device tool with get_time action to get current time (now_ms).',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start_timer', 'start_stopwatch', 'list', 'get_status', 'stop', 'cancel'],
          description: 'Action: start_timer (countdown), start_stopwatch, list (show all), get_status (single), stop (stopwatch only), cancel (delete)',
        },
        duration_ms: {
          type: 'number',
          description: 'For start_timer: duration in milliseconds (e.g. 180000 for 3 minutes)',
        },
        label: {
          type: 'string',
          description: 'Optional label for the timer/stopwatch (e.g. "3 minute timer", "Running stopwatch")',
        },
        timer_id: {
          type: 'string',
          description: 'Timer ID (required for get_status, stop, cancel)',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as TimerAction;

    switch (action) {
      case 'start_timer':
        return this.startTimer(args);
      case 'start_stopwatch':
        return this.startStopwatch(args);
      case 'list':
        return this.listTimers();
      case 'get_status':
        return this.getStatus(args);
      case 'stop':
        return this.stopStopwatch(args);
      case 'cancel':
        return this.cancelTimer(args);
      default:
        return errorResult(`Unknown action: ${action}`);
    }
  }

  // ── Start Timer ────────────────────────────────────────────────────────────

  private async startTimer(args: Record<string, unknown>): Promise<ToolResult> {
    const durationMs = args.duration_ms as number;
    const label = args.label as string | undefined;

    if (!durationMs || durationMs <= 0) {
      return errorResult('Missing or invalid duration_ms parameter');
    }

    const now = Date.now();
    const id = `timer_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const timer: Timer = {
      id,
      label,
      type: 'timer',
      startTimeMs: now,
      durationMs,
      enabled: true,
      createdAt: now,
    };

    try {
      await TimerModule.setTimer(JSON.stringify(timer));
      const durationStr = this.formatDuration(durationMs);
      return successResult(
        `Timer created: ${this.formatTimerDetail(timer)}`,
        `Timer started: ${durationStr}${label ? ` (${label})` : ''}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to start timer: ${errMsg}`);
    }
  }

  // ── Start Stopwatch ─────────────────────────────────────────────────────────

  private async startStopwatch(args: Record<string, unknown>): Promise<ToolResult> {
    const label = args.label as string | undefined;
    const now = Date.now();
    const id = `stopwatch_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const timer: Timer = {
      id,
      label,
      type: 'stopwatch',
      startTimeMs: now,
      enabled: true,
      createdAt: now,
    };

    try {
      await TimerModule.setTimer(JSON.stringify(timer));
      return successResult(
        `Stopwatch created: ${this.formatTimerDetail(timer)}`,
        `Stopwatch started${label ? `: ${label}` : ''}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to start stopwatch: ${errMsg}`);
    }
  }

  // ── List Timers ──────────────────────────────────────────────────────────

  private async listTimers(): Promise<ToolResult> {
    try {
      const json = await TimerModule.getAllTimers();
      const timers = JSON.parse(json) as Timer[];

      if (timers.length === 0) {
        return successResult(
          'No active timers or stopwatches found.',
          'No timers or stopwatches are running',
        );
      }

      const lines = timers.map(t => this.formatTimerListItem(t));
      return successResult(
        `${timers.length} active timer(s):\n${lines.join('\n')}`,
        `You have ${timers.length} active timer(s) or stopwatch(es)`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to list timers: ${errMsg}`);
    }
  }

  // ── Get Status ────────────────────────────────────────────────────────────

  private async getStatus(args: Record<string, unknown>): Promise<ToolResult> {
    const timerId = args.timer_id as string;
    if (!timerId) {
      return errorResult('Missing timer_id parameter');
    }

    try {
      const json = await TimerModule.getTimer(timerId);
      if (!json) {
        return errorResult(`Timer "${timerId}" not found`);
      }
      const timer = JSON.parse(json) as Timer;

      if (timer.type === 'timer') {
        const now = Date.now();
        const elapsed = now - timer.startTimeMs;
        const remaining = Math.max(0, (timer.durationMs ?? 0) - elapsed);
        const remainingStr = this.formatDuration(remaining);
        const displayText = timer.label || 'Timer';
        return successResult(
          `Timer "${displayText}": ${remainingStr} remaining`,
          `${displayText}: ${remainingStr} remaining`,
        );
      } else {
        // stopwatch
        const elapsed = await TimerModule.getElapsedTime(timerId);
        const elapsedStr = this.formatDuration(elapsed);
        const displayText = timer.label || 'Stopwatch';
        return successResult(
          `Stopwatch "${displayText}": ${elapsedStr} elapsed`,
          `${displayText}: ${elapsedStr} elapsed`,
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to get timer status: ${errMsg}`);
    }
  }

  // ── Stop Stopwatch ─────────────────────────────────────────────────────────

  private async stopStopwatch(args: Record<string, unknown>): Promise<ToolResult> {
    const timerId = args.timer_id as string;
    if (!timerId) {
      return errorResult('Missing timer_id parameter');
    }

    try {
      const json = await TimerModule.getTimer(timerId);
      if (!json) {
        return errorResult(`Timer "${timerId}" not found`);
      }
      const timer = JSON.parse(json) as Timer;

      if (timer.type !== 'stopwatch') {
        return errorResult('Can only stop stopwatches. Use cancel to delete a timer.');
      }

      const elapsed = await TimerModule.getElapsedTime(timerId);
      const elapsedStr = this.formatDuration(elapsed);
      await TimerModule.removeTimer(timerId);

      const displayText = timer.label || 'Stopwatch';
      return successResult(
        `Stopwatch "${displayText}" stopped and removed. Elapsed time: ${elapsedStr}`,
        `Stopwatch stopped: ${elapsedStr}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to stop stopwatch: ${errMsg}`);
    }
  }

  // ── Cancel Timer ───────────────────────────────────────────────────────────

  private async cancelTimer(args: Record<string, unknown>): Promise<ToolResult> {
    const timerId = args.timer_id as string;
    if (!timerId) {
      return errorResult('Missing timer_id parameter');
    }

    try {
      const json = await TimerModule.getTimer(timerId);
      if (!json) {
        return errorResult(`Timer "${timerId}" not found`);
      }
      const timer = JSON.parse(json) as Timer;

      await TimerModule.removeTimer(timerId);
      const displayText = timer.label || (timer.type === 'timer' ? 'Timer' : 'Stopwatch');
      return successResult(
        `Timer "${timerId}" cancelled and removed.`,
        `${displayText} cancelled`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to cancel timer: ${errMsg}`);
    }
  }

  // ── Formatting Helpers ────────────────────────────────────────────────────

  /**
   * Full detail for LLM context (includes internal ID for update/delete).
   * NOT shown to the user directly.
   */
  private formatTimerDetail(t: Timer): string {
    const lines: string[] = [`ID: ${t.id}`];
    if (t.label) {
      lines.push(`Label: "${t.label}"`);
    }
    lines.push(`Type: ${t.type}`);
    if (t.type === 'timer' && t.durationMs) {
      lines.push(`Duration: ${this.formatDuration(t.durationMs)}`);
    }
    lines.push(`Start time: ${new Date(t.startTimeMs).toISOString()}`);
    lines.push(`Status: ${t.enabled ? 'active' : 'disabled'}`);
    return lines.join('\n');
  }

  /**
   * List item for LLM context (includes ID so the LLM can refer to it
   * in get_status/stop/cancel calls, but the LLM should NOT relay the ID to the user).
   */
  private formatTimerListItem(t: Timer): string {
    const status = t.enabled ? '✅' : '⏸️';
    const displayText = t.label || (t.type === 'timer' ? 'Timer' : 'Stopwatch');
    if (t.type === 'timer' && t.durationMs) {
      const durationStr = this.formatDuration(t.durationMs);
      return `${status} [${t.id}] ${displayText} – ${durationStr}`;
    } else {
      return `${status} [${t.id}] ${displayText}`;
    }
  }

  /**
   * Format duration in milliseconds to human-readable string.
   */
  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}h ${minutes}min`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
      if (seconds > 0) {
        return `${minutes}min ${seconds}s`;
      }
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
}

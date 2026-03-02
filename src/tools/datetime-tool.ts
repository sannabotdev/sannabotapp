/**
 * DateTimeTool – Date and time calculations using moment.js
 *
 * Supports absolute time calculations (today, tomorrow, next_monday, etc.),
 * relative time calculations (add/subtract), interval conversions, and current time.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import moment from 'moment';

type DateTimeAction = 'now' | 'absolute' | 'add' | 'subtract' | 'interval';

type BaseEnum =
  | 'now'
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'next_monday'
  | 'next_tuesday'
  | 'next_wednesday'
  | 'next_thursday'
  | 'next_friday'
  | 'next_saturday'
  | 'next_sunday'
  | 'next_january'
  | 'next_february'
  | 'next_march'
  | 'next_april'
  | 'next_may'
  | 'next_june'
  | 'next_july'
  | 'next_august'
  | 'next_september'
  | 'next_october'
  | 'next_november'
  | 'next_december';

type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
type IntervalUnit = 'millisecond' | 'ms' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
type AnchorEnum = 'beginofday' | 'endofday' | 'beginofweek' | 'endofweek' | 'beginofmonth' | 'endofmonth';
type OutputUnit = 'seconds' | 'milliseconds';
type OutputFormat = 'timestamp' | 'iso_date' | 'iso_datetime' | 'iso_datetime_utc' | 'iso_datetime_utc_ms';

// ── Tool ─────────────────────────────────────────────────────────────────────

export class DateTimeTool implements Tool {
  name(): string {
    return 'datetime';
  }

  description(): string {
    return [
      'Calculate and manipulate dates and times using moment.js.',
      'Supports absolute time calculations (today, tomorrow, next_monday, next_january, etc.),',
      'relative time calculations (add/subtract from a base time),',
      'interval conversions (convert amount + unit to milliseconds),',
      'and getting the current time.',
      'Actions: now (current time), absolute (base time + optional time/anchor),',
      'add (add time to base), subtract (subtract time from base), interval (convert to ms).',
      'Use this tool for all date/time calculations instead of manual calculations.',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['now', 'absolute', 'add', 'subtract', 'interval'],
          description: 'Action: now (current time), absolute (base time), add (add time), subtract (subtract time), interval (convert to milliseconds)',
        },
        // For absolute
        base: {
          type: 'string',
          description: 'Base time for absolute/add/subtract. Can be: enum value (now, today, tomorrow, yesterday, next_monday-next_sunday, next_january-next_december), Unix timestamp in milliseconds (number), or ISO date/datetime string (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, YYYY-MM-DDTHH:mm:ssZ, etc.).',
        },
        // For add/subtract
        operation: {
          type: 'string',
          enum: ['add', 'subtract'],
          description: 'Operation for add/subtract actions',
        },
        amount: {
          type: 'number',
          description: 'Amount to add/subtract (for add/subtract) or interval amount (for interval)',
        },
        unit: {
          type: 'string',
          enum: ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'],
          description: 'Time unit for add/subtract: second, minute, hour, day, week, month, year',
        },
        interval_unit: {
          type: 'string',
          enum: ['millisecond', 'ms', 'second', 'minute', 'hour', 'day', 'week', 'month', 'year'],
          description: 'Unit for interval conversion: millisecond/ms, second, minute, hour, day, week, month, year',
        },
        time: {
          type: 'string',
          description: 'Time of day in HH:MM or HH:MM:SS format (optional, for absolute/add/subtract)',
        },
        anchor: {
          type: 'string',
          enum: ['beginofday', 'endofday', 'beginofweek', 'endofweek', 'beginofmonth', 'endofmonth'],
          description: 'Anchor point for absolute/add/subtract: beginofday, endofday, beginofweek, endofweek, beginofmonth, endofmonth',
        },
        output_unit: {
          type: 'string',
          enum: ['seconds', 'milliseconds'],
          description: 'Output unit for absolute/add/subtract when output_format is "timestamp": seconds or milliseconds (default: milliseconds)',
        },
        output_format: {
          type: 'string',
          enum: ['timestamp', 'iso_date', 'iso_datetime', 'iso_datetime_utc', 'iso_datetime_utc_ms'],
          description: 'Output format: timestamp (Unix timestamp, uses output_unit), iso_date (YYYY-MM-DD), iso_datetime (YYYY-MM-DDTHH:mm:ss with timezone), iso_datetime_utc (YYYY-MM-DDTHH:mm:ssZ), iso_datetime_utc_ms (YYYY-MM-DDTHH:mm:ss.SSSZ). Default: timestamp',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as DateTimeAction;

    try {
      switch (action) {
        case 'now':
          return this.getNow(args);
        case 'absolute':
          return this.getAbsolute(args);
        case 'add':
          return this.addTime(args);
        case 'subtract':
          return this.subtractTime(args);
        case 'interval':
          return this.convertInterval(args);
        default:
          return errorResult(`Unknown action: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`DateTime calculation failed: ${message}`);
    }
  }

  // ── Now ────────────────────────────────────────────────────────────────────

  private getNow(args: Record<string, unknown> = {}): ToolResult {
    const outputFormat = (args.output_format as OutputFormat) || 'timestamp';
    const outputUnit = (args.output_unit as OutputUnit) || 'milliseconds';
    const m = moment();

    const result = this.formatOutput(m, outputFormat, outputUnit);
    return successResult(
      result.value,
      result.description,
    );
  }

  // ── Absolute ──────────────────────────────────────────────────────────────

  private getAbsolute(args: Record<string, unknown>): ToolResult {
    const base = args.base as BaseEnum | number | string | undefined;
    if (!base) {
      return errorResult('absolute: "base" parameter is required');
    }

    const time = args.time as string | undefined;
    const anchor = args.anchor as AnchorEnum | undefined;
    const outputFormat = (args.output_format as OutputFormat) || 'timestamp';
    const outputUnit = (args.output_unit as OutputUnit) || 'milliseconds';

    let m: moment.Moment;
    try {
      m = this.parseBase(base);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    // Apply anchor if specified
    if (anchor) {
      m = this.applyAnchor(m, anchor);
    }

    // Apply time if specified
    if (time) {
      m = this.applyTime(m, time);
    }

    const result = this.formatOutput(m, outputFormat, outputUnit);
    return successResult(
      result.value,
      result.description,
    );
  }

  // ── Add ────────────────────────────────────────────────────────────────────

  private addTime(args: Record<string, unknown>): ToolResult {
    const base = args.base as BaseEnum | number | string | undefined;
    const amount = args.amount as number;
    const unit = args.unit as TimeUnit;
    const time = args.time as string | undefined;
    const anchor = args.anchor as AnchorEnum | undefined;
    const outputFormat = (args.output_format as OutputFormat) || 'timestamp';
    const outputUnit = (args.output_unit as OutputUnit) || 'milliseconds';

    if (!base) {
      return errorResult('add: "base" parameter is required');
    }
    if (amount === undefined || amount === null) {
      return errorResult('add: "amount" parameter is required');
    }
    if (!unit) {
      return errorResult('add: "unit" parameter is required');
    }

    let m: moment.Moment;
    try {
      m = this.parseBase(base);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    // Apply anchor if specified
    if (anchor) {
      m = this.applyAnchor(m, anchor);
    }

    // Apply time if specified
    if (time) {
      m = this.applyTime(m, time);
    }

    // Add the amount
    m = m.add(amount, unit);

    const result = this.formatOutput(m, outputFormat, outputUnit);
    return successResult(
      result.value,
      result.description,
    );
  }

  // ── Subtract ────────────────────────────────────────────────────────────────

  private subtractTime(args: Record<string, unknown>): ToolResult {
    const base = args.base as BaseEnum | number | string | undefined;
    const amount = args.amount as number;
    const unit = args.unit as TimeUnit;
    const time = args.time as string | undefined;
    const anchor = args.anchor as AnchorEnum | undefined;
    const outputFormat = (args.output_format as OutputFormat) || 'timestamp';
    const outputUnit = (args.output_unit as OutputUnit) || 'milliseconds';

    if (!base) {
      return errorResult('subtract: "base" parameter is required');
    }
    if (amount === undefined || amount === null) {
      return errorResult('subtract: "amount" parameter is required');
    }
    if (!unit) {
      return errorResult('subtract: "unit" parameter is required');
    }

    let m: moment.Moment;
    try {
      m = this.parseBase(base);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    // Apply anchor if specified
    if (anchor) {
      m = this.applyAnchor(m, anchor);
    }

    // Apply time if specified
    if (time) {
      m = this.applyTime(m, time);
    }

    // Subtract the amount
    m = m.subtract(amount, unit);

    const result = this.formatOutput(m, outputFormat, outputUnit);
    return successResult(
      result.value,
      result.description,
    );
  }

  // ── Interval ──────────────────────────────────────────────────────────────

  private convertInterval(args: Record<string, unknown>): ToolResult {
    const amount = args.amount as number;
    const intervalUnit = args.interval_unit as IntervalUnit;

    if (amount === undefined || amount === null) {
      return errorResult('interval: "amount" parameter is required');
    }
    if (!intervalUnit) {
      return errorResult('interval: "interval_unit" parameter is required');
    }

    // Normalize unit name
    const normalizedUnit = intervalUnit === 'ms' ? 'millisecond' : intervalUnit;
    const momentUnit = normalizedUnit as moment.unitOfTime.DurationConstructor;

    const duration = moment.duration(amount, momentUnit);
    const milliseconds = duration.asMilliseconds();

    return successResult(
      `${milliseconds}`,
      `${amount} ${intervalUnit} = ${milliseconds} milliseconds`,
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private formatOutput(
    m: moment.Moment,
    outputFormat: OutputFormat,
    outputUnit: OutputUnit,
  ): { value: string; description: string } {
    switch (outputFormat) {
      case 'timestamp': {
        const timestampMs = m.valueOf();
        const timestamp = outputUnit === 'seconds' ? Math.floor(timestampMs / 1000) : timestampMs;
        const dateStr = m.format('YYYY-MM-DD');
        const timeStr = m.format('HH:mm:ss');
        return {
          value: `${timestamp}`,
          description: `Unix timestamp (${outputUnit}): ${timestamp} for ${dateStr} ${timeStr}`,
        };
      }
      case 'iso_date': {
        const isoDate = m.format('YYYY-MM-DD');
        return {
          value: isoDate,
          description: `ISO date: ${isoDate}`,
        };
      }
      case 'iso_datetime': {
        const isoDateTime = m.format('YYYY-MM-DDTHH:mm:ssZ');
        return {
          value: isoDateTime,
          description: `ISO datetime (local): ${isoDateTime}`,
        };
      }
      case 'iso_datetime_utc': {
        const isoDateTimeUtc = m.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
        return {
          value: isoDateTimeUtc,
          description: `ISO datetime (UTC): ${isoDateTimeUtc}`,
        };
      }
      case 'iso_datetime_utc_ms': {
        const isoDateTimeUtcMs = m.utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
        return {
          value: isoDateTimeUtcMs,
          description: `ISO datetime (UTC with milliseconds): ${isoDateTimeUtcMs}`,
        };
      }
      default: {
        // Fallback to timestamp
        const timestampMs = m.valueOf();
        const timestamp = outputUnit === 'seconds' ? Math.floor(timestampMs / 1000) : timestampMs;
        return {
          value: `${timestamp}`,
          description: `Unix timestamp (${outputUnit}): ${timestamp}`,
        };
      }
    }
  }

  private parseBase(base: BaseEnum | number | string): moment.Moment {
    if (typeof base === 'number') {
      // Base is a Unix timestamp in milliseconds
      return moment(base);
    } else if (typeof base === 'string') {
      // Check if it's an enum value
      const enumValues: BaseEnum[] = [
        'now',
        'today',
        'tomorrow',
        'yesterday',
        'next_monday',
        'next_tuesday',
        'next_wednesday',
        'next_thursday',
        'next_friday',
        'next_saturday',
        'next_sunday',
        'next_january',
        'next_february',
        'next_march',
        'next_april',
        'next_may',
        'next_june',
        'next_july',
        'next_august',
        'next_september',
        'next_october',
        'next_november',
        'next_december',
      ];

      if (enumValues.includes(base as BaseEnum)) {
        return this.getBaseMoment(base as BaseEnum);
      } else {
        // Try to parse as ISO date/datetime string
        const parsed = moment(base);
        if (!parsed.isValid()) {
          throw new Error(
            `Invalid base value: ${base}. Must be an enum value, Unix timestamp, or valid ISO date/datetime string (e.g. YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss).`,
          );
        }
        return parsed;
      }
    } else {
      throw new Error(`Invalid base type: ${typeof base}`);
    }
  }

  private getBaseMoment(base: BaseEnum): moment.Moment {
    const now = moment();

    switch (base) {
      case 'now':
        return moment();
      case 'today':
        return moment().startOf('day');
      case 'tomorrow':
        return moment().add(1, 'day').startOf('day');
      case 'yesterday':
        return moment().subtract(1, 'day').startOf('day');
      case 'next_monday':
        return this.getNextWeekday(1);
      case 'next_tuesday':
        return this.getNextWeekday(2);
      case 'next_wednesday':
        return this.getNextWeekday(3);
      case 'next_thursday':
        return this.getNextWeekday(4);
      case 'next_friday':
        return this.getNextWeekday(5);
      case 'next_saturday':
        return this.getNextWeekday(6);
      case 'next_sunday':
        return this.getNextWeekday(0);
      case 'next_january':
        return this.getNextMonth(0);
      case 'next_february':
        return this.getNextMonth(1);
      case 'next_march':
        return this.getNextMonth(2);
      case 'next_april':
        return this.getNextMonth(3);
      case 'next_may':
        return this.getNextMonth(4);
      case 'next_june':
        return this.getNextMonth(5);
      case 'next_july':
        return this.getNextMonth(6);
      case 'next_august':
        return this.getNextMonth(7);
      case 'next_september':
        return this.getNextMonth(8);
      case 'next_october':
        return this.getNextMonth(9);
      case 'next_november':
        return this.getNextMonth(10);
      case 'next_december':
        return this.getNextMonth(11);
      default:
        return moment();
    }
  }

  private getNextWeekday(targetDay: number): moment.Moment {
    // moment.js: 0=Sunday, 1=Monday, ..., 6=Saturday
    const now = moment();
    const currentDay = now.day();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) {
      daysAhead += 7; // Always advance to NEXT week if today or already passed
    }
    return moment(now).add(daysAhead, 'days').startOf('day');
  }

  private getNextMonth(targetMonth: number): moment.Moment {
    // moment.js: 0=January, 1=February, ..., 11=December
    const now = moment();
    const currentMonth = now.month();
    let monthsAhead = targetMonth - currentMonth;
    if (monthsAhead <= 0) {
      monthsAhead += 12; // Always advance to NEXT year if this month or already passed
    }
    return moment(now).add(monthsAhead, 'months').startOf('month').startOf('day');
  }

  private applyAnchor(m: moment.Moment, anchor: AnchorEnum): moment.Moment {
    switch (anchor) {
      case 'beginofday':
        return m.startOf('day');
      case 'endofday':
        return m.endOf('day');
      case 'beginofweek':
        return m.startOf('week');
      case 'endofweek':
        return m.endOf('week');
      case 'beginofmonth':
        return m.startOf('month');
      case 'endofmonth':
        return m.endOf('month');
      default:
        return m;
    }
  }

  private applyTime(m: moment.Moment, time: string): moment.Moment {
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!timeMatch) {
      throw new Error(`Invalid time format: ${time}. Use HH:MM or HH:MM:SS`);
    }
    const [, hours, minutes, seconds = '0'] = timeMatch;
    return m.hour(parseInt(hours, 10)).minute(parseInt(minutes, 10)).second(parseInt(seconds, 10)).millisecond(0);
  }
}

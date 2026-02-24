/**
 * BeepTool – Play an audible alert tone (beep)
 *
 * Used for timers, alarms, and simple acoustic notifications
 * where spoken text (TTS) would be overkill.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import TTSModule from '../native/TTSModule';

/** Well-known Android ToneGenerator tone types */
const TONE_TYPES: Record<string, number> = {
  beep: 24,     // TONE_PROP_BEEP – single short beep
  ack: 25,      // TONE_PROP_ACK – double-beep acknowledgement
  prompt: 27,   // TONE_PROP_PROMPT – attention prompt
  alarm: 79,    // TONE_CDMA_ALERT_CALL_GUARD – alarm-like tone
};

export class BeepTool implements Tool {
  name(): string {
    return 'beep';
  }

  description(): string {
    return [
      'Play an audible alert tone (beep).',
      'Use this instead of TTS for timers, alarms, and simple acoustic signals',
      'where spoken text would be too much.',
      'Tone types: "beep" (short beep), "ack" (double-beep), "prompt" (attention), "alarm" (alarm tone).',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        tone: {
          type: 'string',
          enum: ['beep', 'ack', 'prompt', 'alarm'],
          description: 'Tone type: "beep" (short beep), "ack" (double-beep), "prompt" (attention), "alarm" (alarm tone). Default: "beep"',
        },
        count: {
          type: 'number',
          description: 'Number of beeps to play (1-10). Default: 3',
        },
        duration_ms: {
          type: 'number',
          description: 'Duration of each beep in milliseconds (100-2000). Default: 500',
        },
      },
      required: [],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const toneName = (args.tone as string) ?? 'beep';
    const count = Math.max(1, Math.min(10, (args.count as number) ?? 3));
    const durationMs = Math.max(100, Math.min(2000, (args.duration_ms as number) ?? 500));

    const toneType = TONE_TYPES[toneName] ?? TONE_TYPES.beep;

    try {
      await TTSModule.playBeep(toneType, durationMs, count);
      return successResult(
        `Beep played: tone=${toneName}, count=${count}, duration=${durationMs}ms`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Beep failed: ${message}`);
    }
  }
}

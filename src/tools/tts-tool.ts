/**
 * TTSTool – Text-to-Speech tool
 *
 * The LLM uses this tool to speak text aloud.
 * In driving mode, ALL responses should go through this tool.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import TTSModule from '../native/TTSModule';

export class TTSTool implements Tool {
  name(): string {
    return 'tts';
  }

  description(): string {
    return 'Read text aloud. Use for ALL responses in driving mode. Speak short, clear sentences.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to be read aloud',
        },
        language: {
          type: 'string',
          description: 'Language tag (e.g. "de-AT", "de-DE", "en-US"). Default: en-US',
        },
      },
      required: ['text'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const text = args.text as string;
    const language = (args.language as string) ?? 'en-US';

    if (!text) {
      return errorResult('text parameter is required');
    }

    try {
      const utteranceId = `tts_${Date.now()}`;
      await TTSModule.speak(text, language, utteranceId);
      return successResult(`TTS: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`TTS failed: ${message}`);
    }
  }
}

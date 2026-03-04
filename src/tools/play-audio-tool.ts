/**
 * PlayAudioTool – Audio playback with position tracking
 *
 * Supports streaming audio from URLs with play/pause/resume/seek controls.
 * Automatically tracks playback position per audio file in file_storage.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import AudioPlayerModule, { AudioPlayerEvents } from '../native/AudioPlayerModule';
import { FileStorageTool } from './file-storage-tool';

const POSITIONS_FILENAME = 'audio_positions';
const POSITION_SAVE_INTERVAL_MS = 10000; // Save position every 10 seconds

interface AudioPosition {
  position_seconds: number;
  timestamp: number;
}

interface AudioPositions {
  [url: string]: AudioPosition;
}

export class PlayAudioTool implements Tool {
  private fileStorage: FileStorageTool;
  private currentUrl: string | null = null;

  constructor() {
    this.fileStorage = new FileStorageTool();
    
    // Listen for playback events to save position
    AudioPlayerEvents.addListener('audio_paused', (data: { url: string; position: number }) => {
      // position is already in seconds from native module
      this.savePosition(data.url, data.position);
    });

    AudioPlayerEvents.addListener('audio_completed', (data: { url: string }) => {
      this.removePosition(data.url);
    });

    AudioPlayerEvents.addListener('audio_stopped', (data: { url: string }) => {
      this.removePosition(data.url);
      this.currentUrl = null;
    });

    // Periodic position saving during playback
    this.startPeriodicSaving();
  }

  name(): string {
    return 'play_audio';
  }

  description(): string {
    return (
      'Play, pause, resume, stop, and seek audio from URLs. ' +
      'Supports common audio formats (MP3, M4A, AAC, OGG). ' +
      'Automatically tracks playback position per audio file. ' +
      'When starting playback, automatically restores the last saved position if available.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'resume', 'stop', 'seek', 'status', 'restore_position'],
          description:
            'play: Start playing audio from URL (stops current if any). ' +
            'pause: Pause current playback. ' +
            'resume: Resume paused playback. ' +
            'stop: Stop current playback. ' +
            'seek: Change position (use offset_seconds for relative, position_seconds for absolute). ' +
            'status: Get current playback status (what is playing, position, duration). ' +
            'restore_position: Restore saved position for a URL (used internally).',
        },
        url: {
          type: 'string',
          description: 'Audio URL to play. Required for action=play.',
        },
        position_seconds: {
          type: 'number',
          description: 'Absolute position in seconds. Used with action=seek (when offset_seconds not provided).',
        },
        offset_seconds: {
          type: 'number',
          description: 'Relative position change in seconds (positive = forward, negative = backward). Used with action=seek.',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as string;

    try {
      switch (action) {
        case 'play':
          return await this.play(args.url as string);
        case 'pause':
          return await this.pause();
        case 'resume':
          return await this.resume();
        case 'stop':
          return await this.stop();
        case 'seek':
          return await this.seek(
            args.position_seconds as number | undefined,
            args.offset_seconds as number | undefined,
          );
        case 'status':
          return await this.getStatus();
        case 'restore_position':
          return await this.restorePosition(args.url as string);
        default:
          return errorResult(`Unknown action: ${String(action)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`PlayAudio error: ${message}`);
    }
  }

  private async play(url: string): Promise<ToolResult> {
    if (!url) {
      return errorResult('url parameter is required for play action');
    }

    try {
      // Restore saved position if available
      const savedPosition = await this.getSavedPosition(url);
      
      // Start playback
      await AudioPlayerModule.play(url);
      this.currentUrl = url;

      // If we have a saved position, seek to it after a short delay (to allow MediaPlayer to prepare)
      if (savedPosition !== null && savedPosition.position_seconds > 0) {
        setTimeout(async () => {
          try {
            await AudioPlayerModule.seek(savedPosition.position_seconds, false);
          } catch (e) {
            // Ignore seek errors (audio might not be ready yet)
          }
        }, 500);
        return successResult(
          `Playing audio from ${url} (resumed from ${savedPosition.position_seconds}s)`,
          `Resuming playback from ${Math.floor(savedPosition.position_seconds / 60)}:${String(Math.floor(savedPosition.position_seconds % 60)).padStart(2, '0')}`,
        );
      }

      return successResult(`Playing audio from ${url}`, 'Playing audio');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to play audio: ${message}`);
    }
  }

  private async pause(): Promise<ToolResult> {
    try {
      const position = await AudioPlayerModule.pause();
      if (position >= 0) {
        await this.savePosition(this.currentUrl || '', position);
        return successResult(`Paused at ${position}s`, `Paused`);
      }
      return successResult('No audio playing to pause');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to pause: ${message}`);
    }
  }

  private async resume(): Promise<ToolResult> {
    try {
      await AudioPlayerModule.resume();
      return successResult('Resumed playback', 'Resumed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to resume: ${message}`);
    }
  }

  private async stop(): Promise<ToolResult> {
    try {
      await AudioPlayerModule.stop();
      if (this.currentUrl) {
        await this.removePosition(this.currentUrl);
      }
      this.currentUrl = null;
      return successResult('Stopped playback', 'Stopped');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to stop: ${message}`);
    }
  }

  private async seek(
    positionSeconds: number | undefined,
    offsetSeconds: number | undefined,
  ): Promise<ToolResult> {
    try {
      if (offsetSeconds !== undefined) {
        // Relative seek
        const newPosition = await AudioPlayerModule.seek(offsetSeconds, true);
        await this.savePosition(this.currentUrl || '', newPosition);
        const direction = offsetSeconds >= 0 ? 'forward' : 'backward';
        const absOffset = Math.abs(offsetSeconds);
        return successResult(
          `Seeked ${direction} by ${absOffset}s to position ${newPosition}s`,
          `Skipped ${direction} ${absOffset}s`,
        );
      } else if (positionSeconds !== undefined) {
        // Absolute seek
        const newPosition = await AudioPlayerModule.seek(positionSeconds, false);
        await this.savePosition(this.currentUrl || '', newPosition);
        return successResult(`Seeked to position ${newPosition}s`, `Seeked to ${Math.floor(newPosition / 60)}:${String(Math.floor(newPosition % 60)).padStart(2, '0')}`);
      } else {
        return errorResult('Either position_seconds or offset_seconds must be provided for seek action');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to seek: ${message}`);
    }
  }

  private async getStatus(): Promise<ToolResult> {
    try {
      const status = await AudioPlayerModule.getStatus();
      
      if (status.status === 'stopped' || !status.url) {
        return successResult('No audio currently playing');
      }

      const remaining = status.duration > 0 ? status.duration - status.position : 0;
      const positionStr = `${Math.floor(status.position / 60)}:${String(Math.floor(status.position % 60)).padStart(2, '0')}`;
      const durationStr = status.duration > 0 ? `${Math.floor(status.duration / 60)}:${String(Math.floor(status.duration % 60)).padStart(2, '0')}` : 'unknown';
      const remainingStr = remaining > 0 ? `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, '0')}` : 'unknown';

      const statusText = `Status: ${status.status}, Position: ${positionStr}/${durationStr}, Remaining: ${remainingStr}`;
      const userText = status.status === 'playing' 
        ? `Playing, ${remainingStr} remaining`
        : status.status === 'paused'
        ? `Paused at ${positionStr}`
        : 'Stopped';

      return successResult(statusText, userText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to get status: ${message}`);
    }
  }

  private async restorePosition(url: string): Promise<ToolResult> {
    if (!url) {
      return errorResult('url parameter is required');
    }

    const position = await this.getSavedPosition(url);
    if (position === null) {
      return successResult(`No saved position for ${url}`);
    }

    return successResult(
      `Saved position for ${url}: ${position.position_seconds}s (saved at ${new Date(position.timestamp).toISOString()})`,
    );
  }

  private async getSavedPosition(url: string): Promise<AudioPosition | null> {
    try {
      const result = await this.fileStorage.execute({
        action: 'read',
        filename: POSITIONS_FILENAME,
        type: 'text',
      });

      if (result.isError || !result.forLLM.includes('Content of')) {
        return null;
      }

      // Extract JSON from result
      const contentMatch = result.forLLM.match(/Content of[^:]*:\s*(.+)/s);
      if (!contentMatch) {
        return null;
      }

      const positions: AudioPositions = JSON.parse(contentMatch[1]);
      return positions[url] || null;
    } catch {
      return null;
    }
  }

  private async savePosition(url: string, positionSeconds: number): Promise<void> {
    if (!url) return;

    try {
      // Read current positions
      const result = await this.fileStorage.execute({
        action: 'read',
        filename: POSITIONS_FILENAME,
        type: 'text',
      });

      let positions: AudioPositions = {};
      if (!result.isError && result.forLLM.includes('Content of')) {
        const contentMatch = result.forLLM.match(/Content of[^:]*:\s*(.+)/s);
        if (contentMatch) {
          try {
            positions = JSON.parse(contentMatch[1]);
          } catch {
            // Invalid JSON, start fresh
          }
        }
      }

      // Update position
      positions[url] = {
        position_seconds: positionSeconds,
        timestamp: Date.now(),
      };

      // Write back
      await this.fileStorage.execute({
        action: 'write',
        filename: POSITIONS_FILENAME,
        content: JSON.stringify(positions, null, 2),
        type: 'text',
      });
    } catch (err) {
      // Silently fail - position tracking is not critical
      console.error('Failed to save audio position:', err);
    }
  }

  private async removePosition(url: string): Promise<void> {
    if (!url) return;

    try {
      const result = await this.fileStorage.execute({
        action: 'read',
        filename: POSITIONS_FILENAME,
        type: 'text',
      });

      if (result.isError || !result.forLLM.includes('Content of')) {
        return;
      }

      const contentMatch = result.forLLM.match(/Content of[^:]*:\s*(.+)/s);
      if (!contentMatch) {
        return;
      }

      const positions: AudioPositions = JSON.parse(contentMatch[1]);
      delete positions[url];

      await this.fileStorage.execute({
        action: 'write',
        filename: POSITIONS_FILENAME,
        content: JSON.stringify(positions, null, 2),
        type: 'text',
      });
    } catch (err) {
      // Silently fail
      console.error('Failed to remove audio position:', err);
    }
  }

  private startPeriodicSaving(): void {
    // Save position periodically during playback
    setInterval(async () => {
      try {
        const status = await AudioPlayerModule.getStatus();
        if (status.status === 'playing' && status.url) {
          await this.savePosition(status.url, status.position);
        }
      } catch {
        // Ignore errors
      }
    }, POSITION_SAVE_INTERVAL_MS);
  }
}

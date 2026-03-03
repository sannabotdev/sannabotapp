/**
 * WakeWordService – Wake Word Detection TypeScript bridge
 * Wraps the WakeWordModule native module and manages detection lifecycle.
 *
 * Uses Picovoice Porcupine for on-device wake word detection.
 * Supported keywords:
 *   - Built-in: "PORCUPINE", "JARVIS", "ALEXA", "HEY_GOOGLE", etc.
 *   - Custom: path to a .ppn file (trained via Picovoice Console)
 */
import WakeWordModule, { WakeWordEvents } from '../native/WakeWordModule';
import { DebugLogger } from '../agent/debug-logger';

type WakeWordCallback = (keyword: string) => void;

export class WakeWordService {
  private onDetected: WakeWordCallback | null = null;
  private detectedSub: ReturnType<typeof WakeWordEvents.addListener> | null = null;
  private errorSub: ReturnType<typeof WakeWordEvents.addListener> | null = null;
  private isActive = false;

  /** Start wake word detection. Calls onDetected when wake word is heard. */
  async start(
    onDetected: WakeWordCallback,
    accessKey: string,
    keywordPath?: string,
  ): Promise<void> {
    if (this.isActive) return;

    this.onDetected = onDetected;

    this.detectedSub = WakeWordEvents.addListener(
      'wake_word_detected',
      (event: { keyword: string; timestamp: number }) => {
        DebugLogger.add('info', 'WakeWord', `Detected: ${event.keyword}`);
        this.onDetected?.(event.keyword);
      },
    );

    this.errorSub = WakeWordEvents.addListener(
      'wake_word_error',
      (event: { error: string }) => {
        DebugLogger.add('error', 'WakeWord', `Error: ${event.error}`);
      },
    );

    await WakeWordModule.startListening(accessKey, keywordPath ?? null);
    this.isActive = true;
    DebugLogger.add('info', 'WakeWord', 'Started listening');
  }

  /** Stop wake word detection */
  async stop(): Promise<void> {
    if (!this.isActive) return;

    this.detectedSub?.remove();
    this.detectedSub = null;
    this.errorSub?.remove();
    this.errorSub = null;
    this.onDetected = null;

    await WakeWordModule.stopListening();
    this.isActive = false;
    DebugLogger.add('info', 'WakeWord', 'Stopped');
  }

  /** Manually trigger wake word detection (for testing / manual button) */
  triggerManually(): void {
    this.onDetected?.('manual');
  }

  isRunning(): boolean {
    return this.isActive;
  }
}

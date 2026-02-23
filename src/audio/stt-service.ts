/**
 * STTService – Speech-to-Text service
 * Uses the native SpeechModule (Android SpeechRecognizer, on-device)
 * No external package needed.
 */
import SpeechModule, { SpeechEvents } from '../native/SpeechModule';
import { DebugLogger } from '../agent/debug-logger';

export interface STTResult {
  text: string;
  isFinal: boolean;
}

export class STTService {
  private subscriptions: ReturnType<typeof SpeechEvents.addListener>[] = [];
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Listen for speech and return final transcript.
   * Resolves when speech ends or rejects on error.
   * @param language BCP-47 language tag (e.g. 'de-AT', 'en-US')
   * @param mode 'auto' (cloud first, fallback on-device), 'offline' (on-device only), 'online' (cloud only)
   */
  async listen(language = 'de-AT', mode: 'auto' | 'offline' | 'online' = 'auto'): Promise<string> {
    return new Promise((resolve, reject) => {
      let lastResult = '';
      let resolved = false;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

      const doResolve = (value: string) => {
        if (resolved) return;
        resolved = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        cleanup();
        resolve(value);
      };

      const doReject = (err: Error) => {
        if (resolved) return;
        resolved = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        cleanup();
        reject(err);
      };

      // Subscribe to events
      const resultsSub = SpeechEvents.addListener(
        'speech_results',
        (event: { value: string[]; strategyType?: string; strategyLanguage?: string }) => {
          if (event.value?.length > 0) {
            lastResult = event.value[0];
            const sType = event.strategyType ?? '?';
            const sLang = event.strategyLanguage ?? '?';
            DebugLogger.add(
              'info',
              'STT',
              `✓ Ergebnis via ${sType} (lang=${sLang}): "${lastResult}"`,
            );
            // speech_results is the final result – resolve immediately
            doResolve(lastResult);
          }
        },
      );

      // speech_end fires BEFORE speech_results (Android lifecycle:
      // onEndOfSpeech → onResults). Do NOT resolve here – just set a
      // fallback timer so we don't hang if results never arrive.
      const endSub = SpeechEvents.addListener('speech_end', () => {
        // Safety timeout: if speech_results hasn't fired 2s after
        // speech_end, resolve with whatever we have (likely '').
        if (!resolved) {
          fallbackTimer = setTimeout(() => doResolve(lastResult), 2000);
        }
      });

      const errorSub = SpeechEvents.addListener(
        'speech_error',
        (event: { code: number; message: string }) => {
          // Codes that mean "no speech" – resolve empty instead of rejecting
          // 7  = ERROR_NO_MATCH
          // 6  = ERROR_SPEECH_TIMEOUT
          // 11 = ERROR_SERVER_DISCONNECTED (emulator / flaky network)
          if (event.code === 7 || event.code === 6 || event.code === 11) {
            DebugLogger.add('info', 'STT', `Kein Ergebnis (code=${event.code}: ${event.message})`);
            doResolve('');
          } else {
            DebugLogger.add('error', 'STT', `Fehler ${event.code}: ${event.message}`);
            doReject(new Error(`STT error ${event.code}: ${event.message}`));
          }
        },
      );

      const cleanup = () => {
        resultsSub.remove();
        endSub.remove();
        errorSub.remove();
      };

      // Start
      DebugLogger.add('info', 'STT', `Starte Spracherkennung (lang=${language}, mode=${mode})`);
      SpeechModule.startListening(language, mode).catch(err => {
        doReject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  /** Stop listening (triggers speech_end event) */
  async stop(): Promise<void> {
    await SpeechModule.stopListening();
  }

  /** Cancel without result */
  async cancel(): Promise<void> {
    await SpeechModule.cancel();
  }

  /** Check if STT is available on device */
  async isAvailable(): Promise<boolean> {
    return SpeechModule.isAvailable();
  }

  isActive(): boolean {
    return false; // Managed by native side
  }

  async destroy(): Promise<void> {
    this.subscriptions.forEach(s => s.remove());
    this.subscriptions = [];
    await SpeechModule.cancel().catch(() => {});
    this.initialized = false;
  }
}

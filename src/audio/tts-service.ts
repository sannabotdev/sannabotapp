/**
 * TTSService – Text-to-Speech service wrapper
 * Manages TTS state and provides a Promise-based interface with completion tracking
 */
import { NativeEventEmitter } from 'react-native';
import TTSModule, { TTSEvents } from '../native/TTSModule';
import { DebugLogger } from '../agent/debug-logger';

type TTSEventCallback = () => void;

export class TTSService {
  private pendingCallbacks: Map<string, TTSEventCallback> = new Map();
  private eventSubscriptions: ReturnType<NativeEventEmitter['addListener']>[] = [];
  private initialized = false;

  init(): void {
    if (this.initialized) return;

    const doneSub = TTSEvents.addListener('tts_done', (event: { utteranceId: string }) => {
      const cb = this.pendingCallbacks.get(event.utteranceId);
      if (cb) {
        this.pendingCallbacks.delete(event.utteranceId);
        cb();
      }
    });

    const errorSub = TTSEvents.addListener('tts_error', (event: { utteranceId: string }) => {
      const cb = this.pendingCallbacks.get(event.utteranceId);
      if (cb) {
        this.pendingCallbacks.delete(event.utteranceId);
        cb(); // Resolve even on error to prevent hanging
      }
    });

    this.eventSubscriptions.push(doneSub, errorSub);
    this.initialized = true;
  }

  /** Speak text and wait for completion */
  async speak(text: string, language = 'en-US'): Promise<void> {
    const utteranceId = `tts_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    DebugLogger.add('info', 'TTS', `Speaking (lang=${language}): "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(utteranceId, resolve);
      TTSModule.speak(text, language, utteranceId).catch(err => {
        this.pendingCallbacks.delete(utteranceId);
        reject(err);
      });
    });
  }

  /** Speak text without waiting */
  speakAsync(text: string, language = 'en-US'): void {
    DebugLogger.add('info', 'TTS', `Speaking async (lang=${language}): "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    TTSModule.speak(text, language, null).catch(console.error);
  }

  /** Stop current speech and resolve any callers awaiting speak() */
  async stop(): Promise<void> {
    // Resolve all pending speak() promises so the pipeline doesn't hang
    const callbacks = Array.from(this.pendingCallbacks.values());
    this.pendingCallbacks.clear();
    callbacks.forEach(cb => cb());
    await TTSModule.stop();
  }

  /** Check if TTS is active */
  async isSpeaking(): Promise<boolean> {
    return TTSModule.isSpeaking();
  }

  destroy(): void {
    this.eventSubscriptions.forEach(sub => sub.remove());
    this.eventSubscriptions = [];
    this.initialized = false;
  }
}

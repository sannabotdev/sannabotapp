/**
 * ConversationPipeline – Orchestrates the full voice interaction flow
 *
 * Flow: Wake Word → STT → LLM (tool loop) → TTS
 *
 * Responsibilities:
 *   - Manage the agent's conversation history (with context management)
 *   - Build system prompt from skill loader + tool registry
 *   - Run the LLM tool loop
 *   - Speak responses via TTS in driving mode
 */
import type { LLMProvider, Message } from '../llm/types';
import type { ToolRegistry } from './tool-registry';
import type { SkillLoader } from './skill-loader';
import { runToolLoop } from './tool-loop';
import { buildSystemPrompt } from './system-prompt';
import type { TTSService } from '../audio/tts-service';
import { DebugLogger } from './debug-logger';

export type PipelineState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface PipelineConfig {
  provider: LLMProvider;
  model: string;
  tools: ToolRegistry;
  skillLoader: SkillLoader;
  ttsService: TTSService;
  drivingMode: boolean;
  maxIterations?: number;
  maxHistoryMessages?: number;
  language?: string;
}

export type StateChangeCallback = (state: PipelineState) => void;
export type ErrorCallback = (error: string) => void;
export type TranscriptCallback = (role: 'user' | 'assistant', text: string) => void;

export class ConversationPipeline {
  private config: PipelineConfig;
  private history: Message[] = [];
  private enabledSkillNames: string[] = [];
  private onStateChange?: StateChangeCallback;
  private onError?: ErrorCallback;
  private onTranscript?: TranscriptCallback;
  private state: PipelineState = 'idle';

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  setCallbacks(callbacks: {
    onStateChange?: StateChangeCallback;
    onError?: ErrorCallback;
    onTranscript?: TranscriptCallback;
  }): void {
    this.onStateChange = callbacks.onStateChange;
    this.onError = callbacks.onError;
    this.onTranscript = callbacks.onTranscript;
  }

  setEnabledSkills(skillNames: string[]): void {
    this.enabledSkillNames = skillNames;
  }

  setDrivingMode(enabled: boolean): void {
    this.config.drivingMode = enabled;
  }

  getState(): PipelineState {
    return this.state;
  }

  /** Clear conversation history */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Start listening state. Used when STT is starting.
   * Only sets state if currently idle or speaking.
   * If already listening, this is a no-op (prevents duplicate calls).
   */
  startListening(): void {
    if (this.state === 'idle' || this.state === 'speaking') {
      this.setState('listening');
    }
    // If already listening, ignore (no-op)
    // If in processing/error, don't override (let current operation finish)
  }

  /**
   * Stop listening and return to idle.
   * Used when STT is cancelled or fails.
   * Also handles cleanup if called from unexpected states.
   */
  stopListening(): void {
    if (this.state === 'listening') {
      this.setState('idle');
    }
    // If not listening, this is a no-op (safe to call multiple times)
  }

  /**
   * Set state to idle explicitly.
   * Used for error recovery or manual state reset.
   */
  setIdle(): void {
    this.setState('idle');
  }

  /**
   * Interrupt ongoing TTS playback and return to idle.
   * Safe to call at any time; no-op if not currently speaking.
   */
  async stopSpeaking(): Promise<void> {
    if (this.state === 'speaking') {
      await this.config.ttsService.stop();
      this.setState('idle');
    }
  }

  /**
   * Process a user utterance through the full pipeline:
   * text → system prompt + history → LLM tool loop → TTS response
   *
   * Options:
   *   - silent: if true, the user text is NOT shown as a bubble in the UI
   *             (used for system-injected messages like notifications)
   */
  async processUtterance(
    userText: string,
    options?: { silent?: boolean },
  ): Promise<string> {
    if (this.state !== 'idle') {
      return '';
    }

    try {
      this.setState('processing');
      if (!options?.silent) {
        this.onTranscript?.('user', userText);
      }
      DebugLogger.logUserMessage(userText);

      // Build system prompt
      const systemPrompt = buildSystemPrompt({
        skillLoader: this.config.skillLoader,
        toolRegistry: this.config.tools,
        enabledSkillNames: this.enabledSkillNames,
        drivingMode: this.config.drivingMode,
        language: this.config.language,
      });
      DebugLogger.logSystemPrompt(systemPrompt);

      // Build messages: system + history + new user message
      const systemMsg: Message = { role: 'system', content: systemPrompt };
      const userMsg: Message = { role: 'user', content: userText };

      const messages: Message[] = [systemMsg, ...this.history, userMsg];
      DebugLogger.logRegisteredTools(
        this.config.tools.list(),
        this.config.tools.definitions(),
      );

      // Save user message to history
      this.history.push(userMsg);

      // Run the agent tool loop
      const result = await runToolLoop(
        {
          provider: this.config.provider,
          model: this.config.model,
          tools: this.config.tools,
          maxIterations: this.config.maxIterations ?? 10,
        },
        messages,
      );

      const assistantText = result.content || 'Task started.';

      // Save intermediate tool call messages to history (assistant tool calls + tool results)
      this.history.push(...result.newMessages);

      // Save final assistant response to history
      this.history.push({ role: 'assistant', content: assistantText });

      // Trim history to avoid context overflow
      this.trimHistory(this.config.maxHistoryMessages ?? 20);

      // Show the final response as a bubble.
      // In driving mode: also speak it via TTS (pipeline-controlled, no tts tool needed).
      // In normal mode: silent – only the bubble is shown.
      if (assistantText) {
        this.onTranscript?.('assistant', assistantText);
        if (this.config.drivingMode) {
          this.setState('speaking');
          // Start TTS - wait for completion
          try {
            await this.config.ttsService.speak(assistantText, this.config.language ?? 'en-US');
          } catch (ttsErr) {
            // TTS error - log but don't fail the whole pipeline
            DebugLogger.logError('TTS', `TTS error: ${ttsErr instanceof Error ? ttsErr.message : String(ttsErr)}`);
          }
          // After speak() completes (or errors), TTS is done, so set idle
          // The tts_done listener in App.tsx should also set it, but this is a fallback
          // Don't override 'listening' state - user might have started listening
          if (this.getState() !== 'listening') {
            this.setState('idle');
          }
        } else {
          // Normal mode: no TTS, so we can set idle immediately
          // Don't override 'listening' state - user might have started listening
          if (this.getState() !== 'listening') {
            this.setState('idle');
          }
        }
      } else {
        // No assistant text, set idle immediately
        // Don't override 'listening' state - user might have started listening
        if (this.getState() !== 'listening') {
          this.setState('idle');
        }
      }

      return assistantText;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      DebugLogger.logError('PIPELINE', message);
      this.setState('error');
      this.onError?.(message);

      // Save an error assistant message so the LLM has context on the next turn
      this.history.push({
        role: 'assistant',
        content: `[Error: ${message}] I was unable to process the request.`,
      });

      // Try to speak error in driving mode
      if (this.config.drivingMode) {
        this.config.ttsService.speakAsync(
          'An error has occurred.',
          this.config.language ?? 'en-US',
        );
      }

      this.setState('idle');
      return '';
    }
  }

  private setState(state: PipelineState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  /**
   * Trim conversation history to prevent context overflow.
   * Keeps the most recent messages, but ensures we never break tool-call chains.
   *
   * OpenAI requires that every message with role 'tool' is preceded by an
   * 'assistant' message that contains the matching tool_calls. A naive slice
   * can cut off the assistant message while keeping orphaned tool results,
   * causing a 400 error.
   *
   * Strategy: slice to ~maxMessages, then advance the start index past any
   * orphaned 'tool' or 'assistant-with-toolCalls' messages so the history
   * always begins with a clean 'user' or plain 'assistant' message.
   */
  private trimHistory(maxMessages: number): void {
    if (this.history.length <= maxMessages) {
      return;
    }

    let start = this.history.length - maxMessages;

    // Advance past any orphaned messages at the cut point:
    // - 'tool' messages without their preceding assistant+toolCalls
    // - 'assistant' messages with toolCalls whose tool results follow
    while (start < this.history.length) {
      const msg = this.history[start];
      if (msg.role === 'tool') {
        // Orphaned tool result – skip
        start++;
      } else if (
        msg.role === 'assistant' &&
        msg.toolCalls &&
        msg.toolCalls.length > 0
      ) {
        // Assistant with tool calls – the following tool results belong to it,
        // but we'd also need those. Safest to skip the whole group.
        start++;
      } else {
        break;
      }
    }

    this.history = this.history.slice(start);
  }

  /** Export history for session persistence */
  exportHistory(): Message[] {
    return [...this.history];
  }

  /** Import saved history (replaces current history) */
  importHistory(history: Message[]): void {
    this.history = [...history];
  }

  /**
   * Append messages to the existing history without replacing it.
   * Used by App.tsx to inject restored background messages (e.g. from HeadlessJS tasks)
   * into the LLM context after the pipeline is already running.
   */
  appendToHistory(messages: Message[]): void {
    this.history.push(...messages);
    this.trimHistory(this.config.maxHistoryMessages ?? 20);
  }
}

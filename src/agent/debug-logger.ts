/**
 * DebugLogger – Central logging for agent observability
 *
 * Logs: system prompts, LLM requests/responses, tool calls, tool results,
 * registered tools, conversation history.
 *
 * Subscribers get notified in real-time (for UI display).
 */
import type { Message } from '../llm/types';

export type LogLevel = 'info' | 'llm' | 'tool' | 'prompt' | 'error';

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  tag: string;
  summary: string;
  detail?: string;
}

type LogSubscriber = (entry: LogEntry) => void;

class DebugLoggerImpl {
  private entries: LogEntry[] = [];
  private subscribers: LogSubscriber[] = [];
  private nextId = 1;
  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(v: boolean) {
    this._enabled = v;
  }

  /** Subscribe to new log entries (returns unsubscribe fn) */
  subscribe(fn: LogSubscriber): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== fn);
    };
  }

  /** Get all entries (most recent first) */
  getEntries(): LogEntry[] {
    return [...this.entries].reverse();
  }

  /** Clear all logs */
  clear(): void {
    this.entries = [];
  }

  // ─── Convenience methods ────────────────────────────────────────────

  /** Log available tools at startup */
  logRegisteredTools(toolNames: string[], definitions: unknown[]): void {
    this.add('info', 'TOOLS', `${toolNames.length} tools registered: ${toolNames.join(', ')}`, JSON.stringify(definitions, null, 2));
  }

  /** Log the full system prompt sent to the LLM */
  logSystemPrompt(prompt: string): void {
    const lines = prompt.split('\n').length;
    this.add('prompt', 'SYSTEM', `System prompt (${lines} lines, ${prompt.length} chars)`, prompt);
  }

  /** Log user message */
  logUserMessage(text: string): void {
    this.add('info', 'USER', `"${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`, text);
  }

  /** Log LLM request (messages count, model) */
  logLLMRequest(model: string, messageCount: number, toolCount: number, messages?: Message[]): void {
    const summary = `Request to ${model} (${messageCount} msgs, ${toolCount} tools)`;
    const detail = messages ? JSON.stringify(messages, null, 2) : undefined;
    this.add('llm', 'LLM→', summary, detail);
  }

  /** Log LLM response */
  logLLMResponse(content: string, toolCalls: { name: string; arguments: Record<string, unknown> }[], usage?: { promptTokens: number; completionTokens: number; totalTokens: number }, fullResponse?: unknown): void {
    const toolStr = toolCalls.length > 0
      ? `+ ${toolCalls.length} Tool-Calls: ${toolCalls.map(tc => tc.name).join(', ')}`
      : '(no tool calls)';
    const usageStr = usage ? ` [${usage.promptTokens}+${usage.completionTokens}=${usage.totalTokens} tokens]` : '';
    const contentPreview = content ? `"${content.slice(0, 100)}${content.length > 100 ? '…' : ''}"` : '(empty)';
    const summary = `${contentPreview} ${toolStr}${usageStr}`;
    // Include full response if provided, otherwise use the structured format
    const detail = fullResponse 
      ? JSON.stringify(fullResponse, null, 2)
      : JSON.stringify({ content, toolCalls, usage }, null, 2);
    this.add('llm', '←LLM', summary, detail);
  }

  /** Log tool execution start */
  logToolCall(name: string, args: Record<string, unknown>): void {
    // Special formatting for http tool calls
    if (name === 'http') {
      const method = (args.method as string) ?? 'GET';
      const url = (args.url as string) ?? '';
      const headers = (args.headers as Record<string, string>) ?? {};
      const body = args.body;
      
      const summary = `${method} ${url}`;
      const detailParts: string[] = [];
      detailParts.push(`Method: ${method}`);
      detailParts.push(`URL: ${url}`);
      
      if (Object.keys(headers).length > 0) {
        detailParts.push(`\nHeaders:\n${JSON.stringify(headers, null, 2)}`);
      }
      
      if (body !== undefined && body !== null) {
        detailParts.push(`\nBody:\n${JSON.stringify(body, null, 2)}`);
      }
      
      const detail = detailParts.join('\n');
      this.add('tool', `TOOL:${name}`, summary, detail);
    } else {
      // Default formatting for other tools
      const argsStr = JSON.stringify(args);
      this.add('tool', `TOOL:${name}`, `Call: ${argsStr.slice(0, 120)}${argsStr.length > 120 ? '…' : ''}`, JSON.stringify(args, null, 2));
    }
  }

  /** Log tool result */
  logToolResult(name: string, forLLM: string, forUser?: string, isError?: boolean): void {
    const prefix = isError ? '❌' : '✅';
    const userStr = forUser ? ` | forUser: "${forUser}"` : '';
    this.add(isError ? 'error' : 'tool', `${prefix} ${name}`, `${forLLM.slice(0, 150)}${forLLM.length > 150 ? '…' : ''}${userStr}`, forLLM);
  }

  /** Log iteration count */
  logLoopIteration(iteration: number, maxIterations: number): void {
    this.add('info', 'LOOP', `Iteration ${iteration + 1}/${maxIterations}`);
  }

  /** Log final result */
  logFinalResult(content: string, iterations: number): void {
    this.add('info', 'DONE', `Done after ${iterations} iteration(s): "${content.slice(0, 100)}${content.length > 100 ? '…' : ''}"`);
  }

  /** Log an error */
  logError(tag: string, message: string): void {
    this.add('error', tag, message);
  }

  // ─── General purpose ────────────────────────────────────────────────

  /** Add a log entry (also used by non-agent subsystems like STT) */
  add(level: LogLevel, tag: string, summary: string, detail?: string): void {
    if (!this._enabled) return;

    const entry: LogEntry = {
      id: this.nextId++,
      timestamp: new Date(),
      level,
      tag,
      summary,
      detail,
    };

    this.entries.push(entry);

    // Keep max 500 entries
    if (this.entries.length > 500) {
      this.entries = this.entries.slice(-500);
    }

    // Console output for Metro / LogCat
    const time = entry.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const prefix = `[${time}] [${tag}]`;
    // Truncate detail only for extremely large payloads (>100 KB)
    const MAX_DETAIL = 100_000;
    const detailStr = detail
      ? detail.length > MAX_DETAIL
        ? detail.slice(0, MAX_DETAIL) + `\n... (truncated after ${MAX_DETAIL} chars)`
        : detail
      : undefined;
    switch (level) {
      case 'error':
        console.error(prefix, summary);
        if (detailStr) console.error(prefix, '[detail]', detailStr);
        break;
      case 'llm':
        console.log(`🤖 ${prefix}`, summary);
        if (detailStr) console.log(`🤖 ${prefix} [detail]`, detailStr);
        break;
      case 'tool':
        console.log(`🔧 ${prefix}`, summary);
        if (detailStr) console.log(`🔧 ${prefix} [detail]`, detailStr);
        break;
      case 'prompt':
        console.log(`📝 ${prefix}`, summary);
        if (detailStr) console.log(`📝 ${prefix} [detail]`, detailStr);
        break;
      default:
        console.log(`ℹ️ ${prefix}`, summary);
        if (detailStr) console.log(`ℹ️ ${prefix} [detail]`, detailStr);
    }

    // Notify subscribers
    for (const sub of this.subscribers) {
      try { sub(entry); } catch { /* ignore */ }
    }
  }
}

/** Singleton debug logger */
export const DebugLogger = new DebugLoggerImpl();

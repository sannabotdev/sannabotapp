/**
 * runToolLoop – Core agent loop
 *
 * Iterates: LLM call → tool calls → tool results → back to LLM
 * until no more tool calls or maxIterations reached.
 */
import type { LLMProvider, Message } from '../llm/types';
import type { ToolRegistry } from './tool-registry';
import { DebugLogger } from './debug-logger';

export interface ToolLoopConfig {
  provider: LLMProvider;
  model: string;
  tools: ToolRegistry;
  maxIterations: number;
  /** Called when a tool result has a forUser value (driving mode TTS) */
  onUserMessage?: (message: string) => void;
  /**
   * Optional early-exit predicate. Checked after every tool call batch.
   * When it returns true the loop stops immediately and `earlyExitContent`
   * is used as the final content instead of waiting for the LLM to stop.
   */
  shouldExit?: () => boolean;
  /** Content to return when shouldExit() fires. */
  earlyExitContent?: () => string;
}

export interface ToolLoopResult {
  content: string;
  iterations: number;
  /** All messages generated during the loop (assistant + tool results) */
  newMessages: Message[];
}

/**
 * Core agent tool loop. Runs the LLM in a loop, executing tool calls
 * until the LLM returns a final text response (no tool calls).
 */
export async function runToolLoop(
  config: ToolLoopConfig,
  messages: Message[],
): Promise<ToolLoopResult> {
  let finalContent = '';
  const newMessages: Message[] = [];

  for (let i = 0; i < config.maxIterations; i++) {
    DebugLogger.logLoopIteration(i, config.maxIterations);
    const toolDefs = config.tools.definitions();

    // Call LLM
    DebugLogger.logLLMRequest(config.model, messages.length, toolDefs.length);
    const response = await config.provider.chat(
      messages,
      toolDefs,
      config.model,
    );
    DebugLogger.logLLMResponse(response.content, response.toolCalls ?? [], response.usage);

    // No tool calls → we have the final answer
    if (!response.toolCalls || response.toolCalls.length === 0) {
      finalContent = response.content;
      DebugLogger.logFinalResult(finalContent, i + 1);
      return { content: finalContent, iterations: i + 1, newMessages };
    }

    // Build assistant message with tool calls
    const assistantMsg: Message = {
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    };
    messages = [...messages, assistantMsg];
    newMessages.push(assistantMsg);

    // Execute all tool calls and collect results
    for (const tc of response.toolCalls) {
      DebugLogger.logToolCall(tc.name, tc.arguments);
      const result = await config.tools.execute(tc.name, tc.arguments);
      DebugLogger.logToolResult(tc.name, result.forLLM, result.forUser, result.isError);

      // In driving mode, speak tool results to user immediately
      if (result.forUser && config.onUserMessage) {
        config.onUserMessage(result.forUser);
      }

      const toolResultMsg: Message = {
        role: 'tool',
        content: result.forLLM,
        toolCallId: tc.id,
      };
      messages = [...messages, toolResultMsg];
      newMessages.push(toolResultMsg);
    }

    // Early-exit check: a tool (e.g. finish_task) requested hard termination
    if (config.shouldExit?.()) {
      const exitContent = config.earlyExitContent?.() ?? finalContent;
      DebugLogger.logFinalResult(exitContent, i + 1);
      return { content: exitContent, iterations: i + 1, newMessages };
    }
  }

  // Max iterations reached
  DebugLogger.logError('LOOP', `Max iterations (${config.maxIterations}) erreicht`);
  return { content: finalContent, iterations: config.maxIterations, newMessages };
}

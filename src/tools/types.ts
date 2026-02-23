/**
 * Tool Types
 *
 * forLLM:  What the LLM sees as the tool result (technical, full detail)
 * forUser: What gets spoken via TTS in driving mode (concise, human-friendly)
 * isError: Whether the tool execution failed
 */

import type { ToolDefinition } from '../llm/types';

export interface ToolResult {
  /** Detailed result fed back into the LLM conversation */
  forLLM: string;
  /** Optional short result spoken aloud to the user (driving mode). Empty = no TTS. */
  forUser?: string;
  /** Whether this result represents an error */
  isError: boolean;
}

export interface Tool {
  /** Unique tool name used by the LLM */
  name(): string;
  /** Human-readable description */
  description(): string;
  /** JSON Schema parameters definition */
  parameters(): Record<string, unknown>;
  /** Execute the tool with given arguments */
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

/** Convert a Tool to an LLM ToolDefinition */
export function toolToDefinition(tool: Tool): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name(),
      description: tool.description(),
      parameters: tool.parameters(),
    },
  };
}

/** Convenience factory for error results */
export function errorResult(message: string): ToolResult {
  return { forLLM: `Error: ${message}`, isError: true };
}

/** Convenience factory for success results */
export function successResult(forLLM: string, forUser?: string): ToolResult {
  return { forLLM, forUser, isError: false };
}

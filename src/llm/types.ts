/**
 * LLM Type Definitions
 */

export interface ToolCall {
  id: string;
  type: 'function';
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string; // For role: 'tool' messages
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMProvider {
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    model: string,
    options?: LLMOptions,
  ): Promise<LLMResponse>;
  getDefaultModel(): string;
}

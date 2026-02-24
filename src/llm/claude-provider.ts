/**
 * Claude Provider – Anthropic Messages API with tool_use support
 */
import type {
  LLMProvider,
  Message,
  ToolDefinition,
  LLMResponse,
  LLMOptions,
  ToolCall,
} from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 8192;

interface AnthropicContent {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

interface AnthropicToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export class ClaudeProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    model: string,
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Convert messages to Anthropic format
    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of conversationMessages) {
      if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const content: AnthropicContent[] = [];
          if (msg.content) {
            content.push({ type: 'text', text: msg.content });
          }
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
          anthropicMessages.push({ role: 'assistant', content });
        } else {
          anthropicMessages.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool') {
        // Tool results go as user messages with tool_result content
        const toolResults: AnthropicToolResult[] = [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId ?? '',
            content: msg.content,
          },
        ];
        // Check if last message is a user message with tool_results to merge
        const last = anthropicMessages[anthropicMessages.length - 1];
        if (last && last.role === 'user' && Array.isArray(last.content)) {
          (last.content as AnthropicContent[]).push(...toolResults);
        } else {
          anthropicMessages.push({ role: 'user', content: toolResults as unknown as AnthropicContent[] });
        }
      } else if (msg.role === 'user') {
        anthropicMessages.push({ role: 'user', content: msg.content });
      }
    }

    // Build Anthropic tools format
    const anthropicTools = tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));

    const body: Record<string, unknown> = {
      model: model || this.defaultModel,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: anthropicMessages,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }
    if (anthropicTools.length > 0) {
      body.tools = anthropicTools;
    }
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error ${response.status}: ${error}`);
    }

    const data = await response.json() as {
      content: AnthropicContent[];
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    // Extract text content and tool calls
    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id ?? `tool-${Date.now()}`,
          type: 'function',
          name: block.name ?? '',
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    const finishReason =
      data.stop_reason === 'tool_use'
        ? 'tool_calls'
        : data.stop_reason === 'end_turn'
          ? 'stop'
          : 'stop';

    return {
      content: textContent,
      toolCalls,
      finishReason,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }
}

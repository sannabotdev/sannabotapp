/**
 * OpenAI Provider – Chat Completions with function calling / tool_calls support
 */
import type {
  LLMProvider,
  Message,
  ToolDefinition,
  LLMResponse,
  LLMOptions,
  ToolCall,
} from './types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_MAX_TOKENS = 8192;

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    defaultModel: string = DEFAULT_MODEL,
    baseUrl: string = OPENAI_API_URL,
  ) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.baseUrl = baseUrl;
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
    // OpenAI uses the same role structure, just map tool messages correctly
    const openAIMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.toolCallId ?? '',
        };
      }
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: 'assistant' as const,
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });

    const resolvedModel = model || this.defaultModel;

    // Newer OpenAI models (gpt-4.1+, gpt-5+, o-series) require
    // 'max_completion_tokens' instead of the legacy 'max_tokens' parameter.
    const useNewTokenParam = /^(gpt-4\.[1-9]|gpt-[5-9]|o[1-9])/.test(resolvedModel);
    const tokenLimit = options.maxTokens ?? DEFAULT_MAX_TOKENS;

    const body: Record<string, unknown> = {
      model: resolvedModel,
      [useNewTokenParam ? 'max_completion_tokens' : 'max_tokens']: tokenLimit,
      messages: openAIMessages,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
    }

    const data = await response.json() as {
      choices: {
        message: {
          content: string | null;
          tool_calls?: {
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }[];
        };
        finish_reason: string;
      }[];
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = data.choices[0];
    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map(tc => ({
      id: tc.id,
      type: 'function' as const,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    const finishReason =
      choice.finish_reason === 'tool_calls'
        ? 'tool_calls'
        : choice.finish_reason === 'stop'
          ? 'stop'
          : 'stop';

    return {
      content: choice.message.content ?? '',
      toolCalls,
      finishReason,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }
}

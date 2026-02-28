/**
 * Skill Test – Tests if a skill is functional by running its test_prompt
 * through a mini tool loop
 */
import type { LLMProvider, Message } from '../llm/types';
import { ToolRegistry } from './tool-registry';
import type { SkillInfo, SkillLoader } from './skill-loader';
import { runToolLoop } from './tool-loop';
import type { Tool, ToolResult } from '../tools/types';
import { successResult } from '../tools/types';

export interface SkillTestResult {
  success: boolean;
  message: string;
  error?: string;
  evidence?: {
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
    toolResults: Array<{ toolName: string; result: string; isError: boolean }>;
    finalResponse?: string;
    iterations: number;
  };
}

/**
 * Run a test for a specific skill using its test_prompt.
 * Builds a minimal system prompt with only this skill and runs a mini tool loop.
 */
export async function runSkillTest(
  skill: SkillInfo,
  skillLoader: SkillLoader,
  provider: LLMProvider,
  toolRegistry: ToolRegistry,
  model: string,
): Promise<SkillTestResult> {
  if (!skill.testPrompt) {
    return {
      success: false,
      message: 'No test prompt defined',
      error: 'Skill has no test_prompt field',
    };
  }

  try {
    // Build a silent registry: identical to the original but with TTS suppressed
    const silentRegistry = buildSilentRegistry(toolRegistry);

    // Build minimal system prompt with only this skill
    const systemPrompt = buildTestSystemPrompt(skill, skillLoader, silentRegistry);

    // Create messages: system + test prompt
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: skill.testPrompt },
    ];

    // Run mini tool loop (max 3 iterations for tests)
    const result = await runToolLoop(
      {
        provider,
        tools: silentRegistry,
        maxIterations: 3,
      },
      messages,
    );

    // Collect evidence: tool calls and results
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const toolResults: Array<{ toolName: string; result: string; isError: boolean }> = [];

    for (const msg of result.newMessages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          toolCalls.push({
            name: tc.name,
            arguments: tc.arguments,
          });
        }
      } else if (msg.role === 'tool') {
        // Find the corresponding tool call
        const assistantMsg = result.newMessages.find(
          m => m.role === 'assistant' && m.toolCalls?.some(tc => tc.id === msg.toolCallId),
        );
        const toolName = assistantMsg?.toolCalls?.find(tc => tc.id === msg.toolCallId)?.name || 'unknown';
        
        const isError = msg.content.toLowerCase().includes('error');
        toolResults.push({
          toolName,
          result: msg.content.substring(0, 500), // Limit length for display
          isError,
        });
      }
    }

    const evidence = {
      toolCalls,
      toolResults,
      finalResponse: result.content,
      iterations: result.iterations,
    };

    // Check if we got tool calls and they executed successfully
    // Success if we got a final response without errors
    if (result.iterations > 0 && result.content) {
      const hasErrors = result.newMessages.some(msg => {
        if (msg.role === 'tool') {
          return msg.content.toLowerCase().includes('error');
        }
        return false;
      });

      if (hasErrors) {
        return {
          success: false,
          message: 'Test failed',
          error: 'Tool calls returned errors',
          evidence,
        };
      }

      return {
        success: true,
        message: 'Test passed',
        evidence,
      };
    }

    // If no tool calls were made, the LLM might not have understood the test
    if (result.iterations === 0) {
      return {
        success: false,
        message: 'Test incomplete',
        error: 'No tool calls were executed',
        evidence,
      };
    }

    return {
      success: true,
      message: 'Test completed',
      evidence,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Test failed',
      error: errorMessage,
      evidence: {
        toolCalls: [],
        toolResults: [],
        iterations: 0,
      },
    };
  }
}

/**
 * Build a copy of the tool registry where all audio-producing tools (tts)
 * are replaced with silent no-ops so skill tests never trigger speech.
 */
function buildSilentRegistry(original: ToolRegistry): ToolRegistry {
  const silent = new ToolRegistry();

  for (const name of original.list()) {
    const tool = original.get(name);
    if (!tool) continue;

    if (name === 'tts') {
      // Replace TTS with a no-op that reports success without speaking
      const silentTts: Tool = {
        name: () => 'tts',
        description: () => tool.description(),
        parameters: () => tool.parameters(),
        execute: async (_args: Record<string, unknown>): Promise<ToolResult> =>
          successResult('[TTS suppressed during skill test]'),
      };
      silent.register(silentTts);
    } else {
      silent.register(tool);
    }
  }

  return silent;
}

/**
 * Build a minimal system prompt for testing a single skill
 */
function buildTestSystemPrompt(
  skill: SkillInfo,
  _skillLoader: SkillLoader,
  toolRegistry: ToolRegistry,
): string {
  const toolSummaries = toolRegistry.getSummaries();
  const parts: string[] = [];

  parts.push(`# Skill Test: ${skill.name}

You are testing the "${skill.name}" skill.

## Available Tools

${toolSummaries.join('\n')}

## Skill Definition

### Skill: ${skill.name}

${skill.content}

## Instructions

Execute the test instruction. Use the appropriate tools to fulfil the request.
Do NOT use the tts tool. Never speak results aloud – just return them as text.`);

  return parts.join('\n\n');
}

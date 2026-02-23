/**
 * Skill Test – Tests if a skill is functional by running its test_prompt
 * through a mini tool loop
 */
import type { LLMProvider, Message } from '../llm/types';
import type { ToolRegistry } from './tool-registry';
import type { SkillInfo, SkillLoader } from './skill-loader';
import { runToolLoop } from './tool-loop';

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
    // Build minimal system prompt with only this skill
    const systemPrompt = buildTestSystemPrompt(skill, skillLoader, toolRegistry);

    // Create messages: system + test prompt
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: skill.testPrompt },
    ];

    // Run mini tool loop (max 3 iterations for tests)
    const result = await runToolLoop(
      {
        provider,
        model,
        tools: toolRegistry,
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

Execute the test instruction. Use the appropriate tools to fulfil the request.`);

  return parts.join('\n\n');
}

/**
 * SkillSummaryGenerator – Generates concise skill summaries using LLM
 *
 * The summary is a condensed version of the skill that includes:
 * - Which tools to use
 * - Key parameters and workflows
 * - Important warnings/constraints
 * - But NOT full step-by-step workflows
 */
import type { LLMProvider } from '../llm/types';
import { SkillSummaryCache } from './skill-summary-cache';
import type { SkillInfo } from './skill-loader';
import { DebugLogger } from './debug-logger';

const SUMMARY_GENERATION_PROMPT = `You are analyzing a skill definition for an AI assistant. Generate a concise summary (max 400 words) that focuses on WHAT the skill can do, not HOW it works.

Focus on:
1. **Capabilities** - What actions and tasks can be performed with this skill? What can the user accomplish?
2. **Use cases** - What are the main scenarios where this skill is useful?
3. **Required authentication** - What authentication/credentials are needed (e.g. OAuth, API keys, etc.)

Do NOT include:
- Technical implementation details (HTTP methods, headers, query parameters, etc.)
- Step-by-step instructions on how to use it
- Internal workflows or technical processes
- Complete JSON request bodies or API call details

Focus on WHAT the user can achieve with this skill, not the technical details of HOW it works. Format the summary as clear, structured text that helps the AI assistant quickly understand what capabilities this skill provides.`;

export interface SkillSummaryGeneratorConfig {
  provider: LLMProvider;
  model: string;
}

export class SkillSummaryGenerator {
  constructor(private config: SkillSummaryGeneratorConfig) {}

  /**
   * Get the hash of the current summary generation prompt.
   * Used to invalidate cached summaries when the prompt changes (e.g. app updates).
   */
  static getPromptHash(): string {
    return SkillSummaryCache.computeHash(SUMMARY_GENERATION_PROMPT);
  }

  /**
   * Get or generate a skill summary.
   * Uses cache if available and content hash matches.
   * Returns the summary and whether it was newly generated (not from cache).
   */
  async getOrGenerateSummary(skill: SkillInfo): Promise<string>;
  async getOrGenerateSummary(skill: SkillInfo, returnGenerated: true): Promise<{ summary: string; wasGenerated: boolean }>;
  async getOrGenerateSummary(skill: SkillInfo, returnGenerated?: boolean): Promise<string | { summary: string; wasGenerated: boolean }> {
    const contentHash = SkillSummaryCache.computeHash(skill.content);
    const promptHash = SkillSummaryGenerator.getPromptHash();

    // Check cache first (must match both content hash and prompt hash)
    const cached = await SkillSummaryCache.getCachedSummary(skill.name, contentHash, promptHash);
    if (cached) {
      if (returnGenerated) {
        return { summary: cached, wasGenerated: false };
      }
      return cached;
    }

    DebugLogger.add('info', 'SKILL_SUMMARY', `Cache miss for skill "${skill.name}" - generating summary`);

    // Generate new summary
    const summary = await this.generateSummary(skill);

    // Store in cache with both content hash and prompt hash
    await SkillSummaryCache.storeSummary(skill.name, summary, contentHash, promptHash);

    DebugLogger.add('info', 'SKILL_SUMMARY', `Summary generated and cached for skill "${skill.name}"`, summary);

    if (returnGenerated) {
      return { summary, wasGenerated: true };
    }
    return summary;
  }

  /**
   * Generate a summary for a skill using LLM.
   */
  private async generateSummary(skill: SkillInfo): Promise<string> {
    const fullContent = `# ${skill.name}\n\n${skill.description}\n\n${skill.content}`;

    const messages = [
      {
        role: 'system' as const,
        content: SUMMARY_GENERATION_PROMPT,
      },
      {
        role: 'user' as const,
        content: `Generate a concise summary for this skill:\n\n${fullContent}`,
      },
    ];

    try {
      // Log LLM request
      DebugLogger.logLLMRequest(
        this.config.model,
        messages.length,
        0, // no tools
        messages,
      );

      const response = await this.config.provider.chat(
        messages,
        [],
      );

      const summary = response.content?.trim() || skill.description;

      // Log LLM response
      DebugLogger.logLLMResponse(
        summary,
        [],
        response.usage,
        response,
      );

      return summary;
    } catch (err) {
      // Fallback to description if LLM call fails
      const errorMessage = err instanceof Error ? err.message : String(err);
      DebugLogger.logError('SKILL_SUMMARY', `Failed to generate summary for ${skill.name}: ${errorMessage}`);
      console.warn(`[SkillSummaryGenerator] Failed to generate summary for ${skill.name}:`, err);
      return skill.description;
    }
  }

  /**
   * Pre-generate summaries for multiple skills (e.g., at app startup).
   * This is async and non-blocking - failures are logged but don't throw.
   */
  async pregenerateSummaries(skills: SkillInfo[]): Promise<void> {
    let generatedCount = 0;
    
    const promises = skills.map(skill =>
      this.getOrGenerateSummary(skill, true).then(result => {
        if (result.wasGenerated) {
          generatedCount++;
        }
        return result.summary;
      }).catch(err => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        DebugLogger.logError('SKILL_SUMMARY', `Failed to pregenerate summary for ${skill.name}: ${errorMessage}`);
        console.warn(`[SkillSummaryGenerator] Failed to pregenerate summary for ${skill.name}:`, err);
      }),
    );

    await Promise.allSettled(promises);
    
    // Only log "Finished" if we actually generated at least one summary
    if (generatedCount > 0) {
      DebugLogger.add('info', 'SKILL_SUMMARY', `Finished generating ${generatedCount} skill summary${generatedCount > 1 ? 'ies' : ''}`);
    }
  }
}

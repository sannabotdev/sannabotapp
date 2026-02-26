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

const SUMMARY_GENERATION_PROMPT = `You are analyzing a skill definition for an AI assistant. Generate a concise summary (max 300 words) that includes:

1. **Tool(s) used** - Which tool(s) this skill uses
2. **Key parameters** - Important parameters and their purposes
3. **Critical constraints** - Important warnings, requirements, or limitations
4. **Basic usage pattern** - How to use this skill (high-level, not step-by-step)

Do NOT include:
- Full step-by-step workflows
- Detailed examples
- Redundant information already in the description

Format the summary as clear, structured text that helps the AI assistant quickly understand how to use this skill.`;

export interface SkillSummaryGeneratorConfig {
  provider: LLMProvider;
  model: string;
}

export class SkillSummaryGenerator {
  constructor(private config: SkillSummaryGeneratorConfig) {}

  /**
   * Get or generate a skill summary.
   * Uses cache if available and content hash matches.
   */
  async getOrGenerateSummary(skill: SkillInfo): Promise<string> {
    const contentHash = SkillSummaryCache.computeHash(skill.content);

    // Check cache first
    const cached = await SkillSummaryCache.getCachedSummary(skill.name, contentHash);
    if (cached) {
      return cached;
    }

    // Generate new summary
    const summary = await this.generateSummary(skill);

    // Store in cache
    await SkillSummaryCache.storeSummary(skill.name, summary, contentHash);

    return summary;
  }

  /**
   * Generate a summary for a skill using LLM.
   */
  private async generateSummary(skill: SkillInfo): Promise<string> {
    const fullContent = `# ${skill.name}\n\n${skill.description}\n\n${skill.content}`;

    try {
      const response = await this.config.provider.chat(
        [
          {
            role: 'system',
            content: SUMMARY_GENERATION_PROMPT,
          },
          {
            role: 'user',
            content: `Generate a concise summary for this skill:\n\n${fullContent}`,
          },
        ],
        [],
        this.config.model,
      );

      const summary = response.content?.trim() || skill.description;
      return summary;
    } catch (err) {
      // Fallback to description if LLM call fails
      console.warn(`[SkillSummaryGenerator] Failed to generate summary for ${skill.name}:`, err);
      return skill.description;
    }
  }

  /**
   * Pre-generate summaries for multiple skills (e.g., at app startup).
   * This is async and non-blocking - failures are logged but don't throw.
   */
  async pregenerateSummaries(skills: SkillInfo[]): Promise<void> {
    const promises = skills.map(skill =>
      this.getOrGenerateSummary(skill).catch(err => {
        console.warn(`[SkillSummaryGenerator] Failed to pregenerate summary for ${skill.name}:`, err);
      }),
    );

    await Promise.allSettled(promises);
  }
}

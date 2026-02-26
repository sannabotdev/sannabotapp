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

const SUMMARY_GENERATION_PROMPT = `You are analyzing a skill definition for an AI assistant. Generate a concise summary (max 400 words) that includes:

1. **Tool(s) used** - Which tool(s) this skill uses
2. **Key parameters** - Important parameters and their exact names/values (especially for HTTP calls: required headers, auth params, etc.)
3. **Critical constraints** - Important warnings, requirements, or limitations. If a required HTTP header is mentioned (e.g. X-Goog-FieldMask), include it VERBATIM with its exact value.
4. **Basic usage pattern** - How to use this skill (high-level, not step-by-step)
5. **When to call skill_detail** - If the skill has complex workflows or detailed API call examples, note that the assistant should call skill_detail to get the full instructions before making API calls.

IMPORTANT: For any HTTP/REST API calls described in the skill:
- Include ALL required headers by name and example value
- Include any mandatory query parameters
- Note if authentication is needed and how (e.g. auth_provider, auth_header values)

Do NOT include:
- Full step-by-step workflows
- Complete JSON request bodies
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

    DebugLogger.add('info', 'SKILL_SUMMARY', `Cache miss for skill "${skill.name}" - generating summary`);

    // Generate new summary
    const summary = await this.generateSummary(skill);

    // Store in cache
    await SkillSummaryCache.storeSummary(skill.name, summary, contentHash);

    DebugLogger.add('info', 'SKILL_SUMMARY', `Summary generated and cached for skill "${skill.name}"`, summary);

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
        this.config.model,
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
    DebugLogger.add('info', 'SKILL_SUMMARY', `Pre-generating summaries for ${skills.length} skills`);
    
    const promises = skills.map(skill =>
      this.getOrGenerateSummary(skill).catch(err => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        DebugLogger.logError('SKILL_SUMMARY', `Failed to pregenerate summary for ${skill.name}: ${errorMessage}`);
        console.warn(`[SkillSummaryGenerator] Failed to pregenerate summary for ${skill.name}:`, err);
      }),
    );

    await Promise.allSettled(promises);
    
    DebugLogger.add('info', 'SKILL_SUMMARY', `Finished pre-generating summaries for ${skills.length} skills`);
  }
}

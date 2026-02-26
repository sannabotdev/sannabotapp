/**
 * SkillDetailTool – Provides full skill descriptions on demand
 *
 * Similar to Moltbot's approach: the agent can request full skill details
 * when needed, rather than having all skills embedded in the system prompt.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import type { SkillLoader } from '../agent/skill-loader';

export class SkillDetailTool implements Tool {
  constructor(private skillLoader: SkillLoader) {}

  name(): string {
    return 'skill_detail';
  }

  description(): string {
    return (
      'Get the full detailed description of a skill, including all workflows, ' +
      'examples, and tool usage instructions. Use this when you need complete information ' +
      'about how to use a specific skill. The skill name should match one from the available skills list.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'The name of the skill to get details for (must match a skill from the available skills list)',
        },
      },
      required: ['skill_name'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const skillName = args.skill_name as string | undefined;

    if (!skillName || typeof skillName !== 'string') {
      return errorResult('Missing or invalid "skill_name" parameter.');
    }

    const skill = this.skillLoader.getSkill(skillName);
    if (!skill) {
      return errorResult(
        `Skill "${skillName}" not found. Use the available skills list to see which skills are available.`,
      );
    }

    const fullDescription = `# ${skill.name}\n\n**Description:** ${skill.description}\n\n**Category:** ${skill.category}\n\n## Full Skill Definition\n\n${skill.content}`;

    return successResult(fullDescription);
  }
}

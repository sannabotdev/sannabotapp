/**
 * ToolRegistry – Register, list and execute tools
 */
import type { Tool, ToolResult } from '../tools/types';
import type { ToolDefinition } from '../llm/types';
import type { SkillLoader } from './skill-loader';
import { toolToDefinition, errorResult } from '../tools/types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private summariesCache: string[] | null = null;

  /** Register a tool. Overwrites if same name exists. */
  register(tool: Tool): void {
    this.tools.set(tool.name(), tool);
    // Invalidate cache when tools change
    this.summariesCache = null;
  }

  /** Remove a tool by name. No-op if the tool is not registered. */
  unregister(name: string): void {
    this.tools.delete(name);
    // Invalidate cache when tools change
    this.summariesCache = null;
  }

  /**
   * Remove tools that belong exclusively to disabled skills.
   * Uses `SkillLoader.getDisabledExclusiveTools()` to determine which tools
   * should be unavailable based on the current set of enabled skills.
   *
   * Call this **after** registering all tools and **before** using the registry.
   */
  removeDisabledSkillTools(
    skillLoader: SkillLoader,
    enabledSkillNames: string[],
  ): void {
    const removed = skillLoader.getDisabledExclusiveTools(enabledSkillNames);
    if (removed.length > 0) {
      for (const name of removed) {
        this.tools.delete(name);
      }
      // Invalidate cache when tools change
      this.summariesCache = null;
    }
  }

  /** Get a tool by name */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** List all registered tool names */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /** Build ToolDefinition array for LLM API calls */
  definitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(toolToDefinition);
  }

  /** Execute a tool by name with given arguments */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return errorResult(`Unknown tool: ${name}`);
    }
    try {
      return await tool.execute(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Tool execution failed: ${message}`);
    }
  }

  /** Get brief summaries for system prompt (cached) */
  getSummaries(): string[] {
    // Return cached result if available
    if (this.summariesCache !== null) {
      return this.summariesCache;
    }

    // Generate summaries
    const summaries = Array.from(this.tools.values())
      .sort((a, b) => a.name().localeCompare(b.name())) // Sort for consistent output
      .map(t => `- **${t.name()}**: ${t.description()}`);

    // Cache result
    this.summariesCache = summaries;
    return summaries;
  }
}

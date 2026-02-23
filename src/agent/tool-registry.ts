/**
 * ToolRegistry – Register, list and execute tools
 */
import type { Tool, ToolResult } from '../tools/types';
import type { ToolDefinition } from '../llm/types';
import { toolToDefinition, errorResult } from '../tools/types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /** Register a tool. Overwrites if same name exists. */
  register(tool: Tool): void {
    this.tools.set(tool.name(), tool);
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

  /** Get brief summaries for system prompt */
  getSummaries(): string[] {
    return Array.from(this.tools.values()).map(
      t => `- **${t.name()}**: ${t.description()}`,
    );
  }
}

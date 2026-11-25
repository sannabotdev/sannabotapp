/**
 * ToolRegistry – Register, list and execute tools
 */
import type { Tool, ToolResult } from '../tools/types';
import type { ToolDefinition } from '../llm/types';
import type { SkillLoader } from './skill-loader';
import { toolToDefinition, errorResult } from '../tools/types';
import { evaluate, type SafetyContext } from '../security/safety-policy';
import { DebugLogger } from './debug-logger';

/**
 * Asks the user to approve one action. Resolves true only on an explicit yes.
 * `summary` is a short human-readable description of what will happen.
 */
export type ConfirmFn = (
  summary: string,
  messageKey?: string,
  params?: Record<string, string>,
) => Promise<boolean>;

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private summariesCache: string[] | null = null;

  /**
   * Safety context. Defaults to 'scheduled' (background) so that any registry
   * nobody explicitly marked as interactive can never run a sensitive action
   * without a user present. Safe by default.
   */
  private safetyContext: SafetyContext = 'scheduled';
  private confirmFn: ConfirmFn | null = null;

  /**
   * Mark this registry as running for a given context. For 'interactive',
   * pass a confirm function that actually asks the user; without one,
   * sensitive actions are denied.
   */
  setSafety(context: SafetyContext, confirm?: ConfirmFn): void {
    this.safetyContext = context;
    this.confirmFn = confirm ?? null;
  }

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

    // ── Safety gate (code, not LLM – cannot be talked around) ──
    const decision = evaluate(this.safetyContext, name, args ?? {});
    if (decision.kind === 'deny') {
      DebugLogger.add('error', 'Safety', `Blocked ${name}: ${decision.reason}`);
      return errorResult(`Blocked by safety policy: ${decision.reason}`);
    }
    if (decision.kind === 'confirm') {
      let approved = false;
      if (this.confirmFn) {
        try {
          approved = await this.confirmFn(decision.summary, decision.messageKey, decision.params);
        } catch {
          approved = false;
        }
      }
      DebugLogger.add('info', 'Safety', `${approved ? 'Approved' : 'Declined'}: ${decision.summary}`);
      if (!approved) {
        return errorResult(
          `The user did NOT approve this action ("${decision.summary}"). ` +
          'Do not retry it or try a different way to do the same thing. Tell the user it was cancelled.',
        );
      }
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

    // Generate summaries (description + optional system hint)
    const summaries = Array.from(this.tools.values())
      .sort((a, b) => a.name().localeCompare(b.name())) // Sort for consistent output
      .map(t => {
        const hint = t.systemHint?.();
        const base = `- **${t.name()}**: ${t.description()}`;
        return hint ? `${base} — *Hint: ${hint}*` : base;
      });

    // Cache result
    this.summariesCache = summaries;
    return summaries;
  }
}

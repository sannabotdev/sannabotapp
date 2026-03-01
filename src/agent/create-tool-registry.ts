/**
 * createToolRegistry – Central factory for the standard tool set.
 *
 * Every place that needs the "normal" agent tools (main pipeline, skill tests,
 * headless scheduler) should call this instead of hand-registering each tool.
 * This avoids duplicating the same registration block in multiple files.
 */
import { ToolRegistry } from './tool-registry';
import { CredentialManager } from '../permissions/credential-manager';
import type { SkillLoader } from './skill-loader';
import type { LLMProvider } from '../llm/types';

// Tools
import { IntentTool } from '../tools/intent-tool';
import { TTSTool } from '../tools/tts-tool';
import { HttpTool } from '../tools/http-tool';
import { QueryTool } from '../tools/query-tool';
import { DeviceTool } from '../tools/device-tool';
import { SmsTool } from '../tools/sms-tool';
import { SchedulerTool } from '../tools/scheduler-tool';
import { NotificationListenerTool } from '../tools/notification-listener-tool';
import { AccessibilityTool } from '../tools/accessibility-tool';
import { FileStorageTool } from '../tools/file-storage-tool';
import { BeepTool } from '../tools/beep-tool';
import { AppSearchTool } from '../tools/app-search-tool';
import { SkillDetailTool } from '../tools/skill-detail-tool';
import { CheckCredentialTool } from '../tools/check-credential-tool';
import { PersonalMemoryTool } from '../tools/personal-memory-tool';
import { GmailSendTool } from '../tools/gmail-send-tool';
import { JournalTool } from '../tools/journal-tool';

export interface CreateToolRegistryOptions {
  credentialManager: CredentialManager;
  skillLoader: SkillLoader;

  /**
   * Include the TTS tool.
   * - `true` for headless / skill-test contexts (sub-agent speaks via tool).
   * - `false` (default) for the interactive pipeline (TTS handled by the pipeline itself).
   */
  includeTts?: boolean;

  /**
   * Include the Scheduler tool.
   * - `false` for the headless sub-agent (prevents recursive schedule creation).
   * - `true` (default) everywhere else.
   */
  includeScheduler?: boolean;

  /**
   * Include personal-memory write tool.
   * Enable in main loop, disable in sub-agent loops.
   */
  includePersonalMemoryTool?: boolean;

  /**
   * LLM provider for memory condensing after each upsert.
   * Only used when includePersonalMemoryTool is true.
   */
  provider?: LLMProvider;
}

/**
 * Create a ToolRegistry pre-loaded with the standard tool set.
 *
 * After calling this you can still call `registry.removeDisabledSkillTools()`
 * to strip tools whose exclusive skill is disabled.
 */
export async function createToolRegistry(opts: CreateToolRegistryOptions): Promise<ToolRegistry> {
  const registry = new ToolRegistry();

  registry.register(new IntentTool());
  if (opts.includeTts) {
    registry.register(new TTSTool());
  }
  registry.register(new HttpTool(opts.credentialManager));
  registry.register(new QueryTool());
  registry.register(new DeviceTool());
  registry.register(new SmsTool());
  if (opts.includeScheduler !== false) {
    registry.register(new SchedulerTool());
  }
  registry.register(new NotificationListenerTool());
  registry.register(new AccessibilityTool());
  registry.register(new AppSearchTool());
  registry.register(new FileStorageTool());
  registry.register(new BeepTool());
  registry.register(new SkillDetailTool(opts.skillLoader));
  registry.register(new CheckCredentialTool(opts.credentialManager));
  registry.register(new JournalTool());
  if (opts.includePersonalMemoryTool !== false) {
    registry.register(new PersonalMemoryTool(opts.provider));
  }

  // Conditionally register GmailSendTool if Gmail skill is enabled and configured
  const gmailSkill = opts.skillLoader.getSkill('gmail');
  if (gmailSkill) {
    const credentialsConfigured = await opts.credentialManager.areAllConfigured(gmailSkill.credentials);
    if (credentialsConfigured) {
      registry.register(new GmailSendTool(opts.credentialManager));
    }
  }

  return registry;
}

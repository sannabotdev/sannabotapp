/**
 * NotificationListenerTool – Manage notification rules and retrieve notifications
 *
 * Each "subscription" is a rule with:
 *   - app (package name)
 *   - instruction (what the sub-agent should do – like the scheduler)
 *   - optional condition (natural language – evaluated by the LLM)
 *
 * When a notification arrives from a subscribed app, ALL enabled rules for
 * that app are sent to a sub-agent. The LLM evaluates each rule's condition
 * and executes the first matching instruction.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import {
  getNotificationListenerModule,
  type NotificationData,
} from '../native/NotificationListenerModule';
import {
  loadRules,
  addRule,
  updateRule,
  deleteRule,
  deleteRulesForApp,
  type NotificationRule,
} from '../agent/notification-rules-store';

// ── App Alias Mapping ─────────────────────────────────────────────────────────

/**
 * Map natural language app names to Android package names.
 */
const APP_ALIASES: Record<string, string> = {
  whatsapp: 'com.whatsapp',
  email: 'com.google.android.gm',
  gmail: 'com.google.android.gm',
  telegram: 'org.telegram.messenger',
  signal: 'org.thoughtcrime.securesms',
  sms: 'com.android.mms',
  messages: 'com.android.mms',
  instagram: 'com.instagram.android',
  facebook: 'com.facebook.katana',
  messenger: 'com.facebook.orca',
  twitter: 'com.twitter.android',
  slack: 'com.Slack',
  discord: 'com.discord',
  teams: 'com.microsoft.teams',
  outlook: 'com.microsoft.office.outlook',
  calendar: 'com.google.android.calendar',
};

/**
 * Resolve an app identifier (alias or package name) to a package name.
 */
function resolvePackageName(app: string): string {
  const lower = app.toLowerCase().trim();
  return APP_ALIASES[lower] || app;
}

/**
 * Get a human-readable app name from a package name.
 */
function getAppDisplayName(packageName: string): string {
  const entry = Object.entries(APP_ALIASES).find(([, pkg]) => pkg === packageName);
  if (entry) {
    return entry[0].charAt(0).toUpperCase() + entry[0].slice(1);
  }
  const parts = packageName.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
}

type NotificationAction =
  | 'subscribe'
  | 'unsubscribe'
  | 'update_rule'
  | 'delete_rule'
  | 'list_subscriptions'
  | 'get_recent'
  | 'clear';

// ── Tool ─────────────────────────────────────────────────────────────────────

export class NotificationListenerTool implements Tool {
  name(): string {
    return 'notifications';
  }

  description(): string {
    return [
      'Manage notification rules: subscribe (create rule with instruction + optional condition),',
      'unsubscribe (remove all rules for an app), update_rule, delete_rule,',
      'list_subscriptions (show all rules),',
      'get_recent (retrieve recent notifications), clear (clear buffer).',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'subscribe',
            'unsubscribe',
            'update_rule',
            'delete_rule',
            'list_subscriptions',
            'get_recent',
            'clear',
          ],
          description:
            'Action: subscribe (create notification rule), unsubscribe (remove all rules for app), ' +
            'update_rule (update existing rule), delete_rule (remove one rule by id), ' +
            'list_subscriptions (show all rules), get_recent (retrieve recent), clear (clear buffer)',
        },
        app: {
          type: 'string',
          description:
            'App name or package name (e.g. "whatsapp", "email", "telegram" or "com.whatsapp"). For subscribe/unsubscribe.',
        },
        instruction: {
          type: 'string',
          description:
            'What the sub-agent should do when a matching notification arrives. ' +
            'Write as a natural-language instruction for an AI agent with all available tools. ' +
            'Example: "Read the message aloud via TTS", "Reply via WhatsApp with OK". ' +
            'Default: "Briefly announce this notification via TTS".',
        },
        condition: {
          type: 'string',
          description:
            'Optional natural-language condition. The LLM evaluates this against the notification to decide if the rule applies. ' +
            'Leave empty for a catch-all rule that applies to every notification from this app. ' +
            'Example: "The sender is my team lead", "The message mentions a meeting".',
        },
        rule_id: {
          type: 'string',
          description:
            'The ID of a specific rule (for update_rule / delete_rule). Get IDs via list_subscriptions.',
        },
        filter_app: {
          type: 'string',
          description: 'Optional: filter get_recent by app name or package name',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const module = getNotificationListenerModule();
    if (!module) {
      return errorResult('NotificationListener is only available on Android');
    }

    const action = args.action as NotificationAction;

    try {
      switch (action) {
        case 'subscribe':
          return this.subscribe(args);
        case 'unsubscribe':
          return this.unsubscribe(args);
        case 'update_rule':
          return this.updateRuleAction(args);
        case 'delete_rule':
          return this.deleteRuleAction(args);
        case 'list_subscriptions':
          return this.listSubscriptions();
        case 'get_recent':
          return this.getRecent(module, args);
        case 'clear':
          return this.clear(module);
        default:
          return errorResult(`Unknown action: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Error: ${message}`);
    }
  }

  // ── Subscribe (create rule) ───────────────────────────────────────────────

  private async subscribe(args: Record<string, unknown>): Promise<ToolResult> {
    const app = args.app as string;
    if (!app) {
      return errorResult('Missing app parameter – which app should be subscribed?');
    }

    const packageName = resolvePackageName(app);
    const appLabel = getAppDisplayName(packageName);
    const instruction = (args.instruction as string) || 'Briefly announce this notification to the user via the tts tool.';
    const condition = (args.condition as string) || '';

    const rule = await addRule({
      app: packageName,
      appLabel,
      enabled: true,
      instruction,
      condition,
    });

    const condStr = condition ? `\nCondition: ${condition}` : ' (catch-all – all notifications)';

    return successResult(
      `Rule created for ${appLabel}${condStr}.\n` +
      `Rule ID: ${rule.id}\n` +
      `Instruction: ${instruction}\n` +
      `When a matching notification arrives, a sub-agent will execute this instruction.`,
      `${appLabel} rule created`,
    );
  }

  // ── Unsubscribe (remove all rules for app) ────────────────────────────────

  private async unsubscribe(args: Record<string, unknown>): Promise<ToolResult> {
    const app = args.app as string;
    if (!app) {
      return errorResult('Missing app parameter – which app should be unsubscribed?');
    }

    const packageName = resolvePackageName(app);
    const appLabel = getAppDisplayName(packageName);
    const removed = await deleteRulesForApp(packageName);

    if (removed === 0) {
      return successResult(
        `${appLabel} has no active rules.`,
        `${appLabel} was not active`,
      );
    }

    return successResult(
      `${removed} rule(s) for ${appLabel} removed. Notifications will be ignored.`,
      `${appLabel}: ${removed} rule(s) removed`,
    );
  }

  // ── Update rule ───────────────────────────────────────────────────────────

  private async updateRuleAction(args: Record<string, unknown>): Promise<ToolResult> {
    const ruleId = args.rule_id as string;
    if (!ruleId) {
      return errorResult('Missing rule_id parameter. Use list_subscriptions to get rule IDs.');
    }

    const updates: Partial<Pick<NotificationRule, 'instruction' | 'condition' | 'enabled'>> = {};
    if (args.instruction !== undefined) { updates.instruction = args.instruction as string; }
    if (args.condition !== undefined) { updates.condition = args.condition as string; }

    const updated = await updateRule(ruleId, updates);
    if (!updated) {
      return errorResult(`Rule ${ruleId} not found.`);
    }

    return successResult(
      `Rule ${ruleId} updated.\nInstruction: ${updated.instruction}` +
      (updated.condition ? `\nCondition: ${updated.condition}` : ''),
      `Rule updated`,
    );
  }

  // ── Delete rule ───────────────────────────────────────────────────────────

  private async deleteRuleAction(args: Record<string, unknown>): Promise<ToolResult> {
    const ruleId = args.rule_id as string;
    if (!ruleId) {
      return errorResult('Missing rule_id parameter. Use list_subscriptions to get rule IDs.');
    }

    const deleted = await deleteRule(ruleId);
    if (!deleted) {
      return errorResult(`Rule ${ruleId} not found.`);
    }

    return successResult(`Rule ${ruleId} deleted.`, 'Rule deleted');
  }

  // ── List Subscriptions (rules) ─────────────────────────────────────────────

  private async listSubscriptions(): Promise<ToolResult> {
    const rules = await loadRules();

    if (rules.length === 0) {
      return successResult(
        'No notification rules configured. Use subscribe to create rules.',
        'No notification rules',
      );
    }

    const lines = rules.map((r, i) => {
      const status = r.enabled ? '✅' : '⏸️';
      const condStr = r.condition ? `\n   Condition: ${r.condition}` : ' (catch-all)';
      return `${i + 1}. ${status} ${r.appLabel}${condStr}\n   Instruction: ${r.instruction}\n   ID: ${r.id}`;
    });

    return successResult(
      `${rules.length} notification rule(s):\n${lines.join('\n')}`,
      `${rules.length} rule(s)`,
    );
  }

  // ── Get Recent ─────────────────────────────────────────────────────────────

  private async getRecent(
    module: NonNullable<ReturnType<typeof getNotificationListenerModule>>,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    try {
      const json = await module.getRecentNotifications();
      let notifications = JSON.parse(json) as NotificationData[];

      const filterApp = args.filter_app as string | undefined;
      if (filterApp) {
        const filterPackage = resolvePackageName(filterApp);
        notifications = notifications.filter(n => n.packageName === filterPackage);
      }

      if (notifications.length === 0) {
        return successResult(
          'No notifications available.',
          'No notifications',
        );
      }

      const lines = notifications.map((n, idx) => {
        const appName = getAppDisplayName(n.packageName);
        const sender = n.sender ? ` from ${n.sender}` : '';
        const time = new Date(n.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${idx + 1}. ${appName}${sender} (${time}): ${n.title || ''} ${n.text || ''}`.trim();
      });

      const summary = `${notifications.length} notification(s):\n${lines.join('\n')}`;
      return successResult(summary, `${notifications.length} notifications found`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to retrieve notifications: ${message}`);
    }
  }

  // ── Clear ──────────────────────────────────────────────────────────────────

  private async clear(
    module: NonNullable<ReturnType<typeof getNotificationListenerModule>>,
  ): Promise<ToolResult> {
    try {
      await module.clearNotifications();
      return successResult('Notification buffer cleared.', 'Buffer cleared');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to clear buffer: ${message}`);
    }
  }
}

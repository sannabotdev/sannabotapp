/**
 * NotificationListenerTool – Manage notification subscriptions and retrieve notifications
 *
 * Allows the LLM to:
 * - Subscribe/unsubscribe to notifications from specific apps
 * - List active subscriptions
 * - Retrieve recent notifications
 * - Clear notification buffer
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import {
  getNotificationListenerModule,
  type NotificationData,
} from '../native/NotificationListenerModule';

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
  // Extract app name from package (e.g., "com.whatsapp" -> "WhatsApp")
  const parts = packageName.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
}

type NotificationAction = 'subscribe' | 'unsubscribe' | 'list_subscriptions' | 'get_recent' | 'clear';

// ── Tool ─────────────────────────────────────────────────────────────────────

export class NotificationListenerTool implements Tool {
  name(): string {
    return 'notifications';
  }

  description(): string {
    return [
      'Verwaltet Benachrichtigungen von Apps (WhatsApp, Email, Telegram, etc.).',
      'Aktionen: subscribe (abonnieren), unsubscribe (abmelden), list_subscriptions (Liste anzeigen),',
      'get_recent (letzte Benachrichtigungen abrufen), clear (Puffer löschen).',
    ].join(' ');
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['subscribe', 'unsubscribe', 'list_subscriptions', 'get_recent', 'clear'],
          description:
            'Aktion: subscribe (App abonnieren), unsubscribe (abmelden), list_subscriptions (alle anzeigen), get_recent (letzte abrufen), clear (Puffer löschen)',
        },
        app: {
          type: 'string',
          description:
            'App-Name oder Paketname (z.B. "whatsapp", "email", "telegram" oder "com.whatsapp"). Für subscribe/unsubscribe.',
        },
        filter_app: {
          type: 'string',
          description: 'Optional: Filter für get_recent nach App-Name oder Paketname',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const module = getNotificationListenerModule();
    if (!module) {
      return errorResult('NotificationListener ist nur auf Android verfügbar');
    }

    const action = args.action as NotificationAction;

    try {
      switch (action) {
        case 'subscribe':
          return this.subscribe(module, args);
        case 'unsubscribe':
          return this.unsubscribe(module, args);
        case 'list_subscriptions':
          return this.listSubscriptions(module);
        case 'get_recent':
          return this.getRecent(module, args);
        case 'clear':
          return this.clear(module);
        default:
          return errorResult(`Unbekannte Aktion: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Fehler: ${message}`);
    }
  }

  // ── Subscribe ──────────────────────────────────────────────────────────────

  private async subscribe(
    module: ReturnType<typeof getNotificationListenerModule>,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const app = args.app as string;
    if (!app) {
      return errorResult('app Parameter fehlt – welche App soll abonniert werden?');
    }

    const packageName = resolvePackageName(app);

    try {
      const json = await module.getSubscribedApps();
      const subscribed = JSON.parse(json) as string[];

      if (subscribed.includes(packageName)) {
        return successResult(
          `${getAppDisplayName(packageName)} ist bereits abonniert.`,
          `${getAppDisplayName(packageName)} ist bereits aktiv`,
        );
      }

      subscribed.push(packageName);
      await module.setSubscribedApps(JSON.stringify(subscribed));

      return successResult(
        `${getAppDisplayName(packageName)} erfolgreich abonniert. Neue Benachrichtigungen werden erfasst.`,
        `${getAppDisplayName(packageName)} abonniert`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Abonnieren fehlgeschlagen: ${message}`);
    }
  }

  // ── Unsubscribe ───────────────────────────────────────────────────────────

  private async unsubscribe(
    module: ReturnType<typeof getNotificationListenerModule>,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const app = args.app as string;
    if (!app) {
      return errorResult('app Parameter fehlt – welche App soll abgemeldet werden?');
    }

    const packageName = resolvePackageName(app);

    try {
      const json = await module.getSubscribedApps();
      const subscribed = JSON.parse(json) as string[];

      const index = subscribed.indexOf(packageName);
      if (index === -1) {
        return successResult(
          `${getAppDisplayName(packageName)} ist nicht abonniert.`,
          `${getAppDisplayName(packageName)} war nicht aktiv`,
        );
      }

      subscribed.splice(index, 1);
      await module.setSubscribedApps(JSON.stringify(subscribed));

      return successResult(
        `${getAppDisplayName(packageName)} erfolgreich abgemeldet. Benachrichtigungen werden ignoriert.`,
        `${getAppDisplayName(packageName)} abgemeldet`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Abmelden fehlgeschlagen: ${message}`);
    }
  }

  // ── List Subscriptions ──────────────────────────────────────────────────────

  private async listSubscriptions(
    module: ReturnType<typeof getNotificationListenerModule>,
  ): Promise<ToolResult> {
    try {
      const json = await module.getSubscribedApps();
      const subscribed = JSON.parse(json) as string[];

      if (subscribed.length === 0) {
        return successResult(
          'Keine Apps abonniert. Nutze subscribe um Benachrichtigungen zu aktivieren.',
          'Keine Apps abonniert',
        );
      }

      const displayNames = subscribed.map(pkg => getAppDisplayName(pkg));
      const list = displayNames.join(', ');

      return successResult(
        `Abonnierte Apps (${subscribed.length}): ${list}`,
        `${subscribed.length} Apps abonniert: ${list}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Auflisten fehlgeschlagen: ${message}`);
    }
  }

  // ── Get Recent ─────────────────────────────────────────────────────────────

  private async getRecent(
    module: ReturnType<typeof getNotificationListenerModule>,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    try {
      const json = await module.getRecentNotifications();
      let notifications = JSON.parse(json) as NotificationData[];

      // Filter by app if specified
      const filterApp = args.filter_app as string | undefined;
      if (filterApp) {
        const filterPackage = resolvePackageName(filterApp);
        notifications = notifications.filter(n => n.packageName === filterPackage);
      }

      if (notifications.length === 0) {
        return successResult(
          'Keine Benachrichtigungen vorhanden.',
          'Keine Benachrichtigungen',
        );
      }

      // Format notifications for LLM
      const lines = notifications.map((n, idx) => {
        const appName = getAppDisplayName(n.packageName);
        const sender = n.sender ? ` von ${n.sender}` : '';
        const time = new Date(n.timestamp).toLocaleTimeString('de-AT', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${idx + 1}. ${appName}${sender} (${time}): ${n.title || ''} ${n.text || ''}`.trim();
      });

      const summary = `${notifications.length} Benachrichtigung(en):\n${lines.join('\n')}`;

      return successResult(summary, `${notifications.length} Benachrichtigungen gefunden`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Abrufen fehlgeschlagen: ${message}`);
    }
  }

  // ── Clear ──────────────────────────────────────────────────────────────────

  private async clear(
    module: ReturnType<typeof getNotificationListenerModule>,
  ): Promise<ToolResult> {
    try {
      await module.clearNotifications();
      return successResult(
        'Benachrichtigungs-Puffer gelöscht.',
        'Puffer gelöscht',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Löschen fehlgeschlagen: ${message}`);
    }
  }
}

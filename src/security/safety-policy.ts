/**
 * SafetyPolicy – decides whether a tool call may run.
 *
 * Every tool call the LLM makes goes through ToolRegistry.execute(), which
 * asks this policy first. The policy is deliberately *not* LLM-based: it is
 * plain code that a prompt injection cannot talk its way around.
 *
 * Three outcomes:
 *   - allow:   run the tool
 *   - confirm: run only after the user explicitly says yes
 *   - deny:    never run (blocked app, credential leak, …)
 *
 * In background contexts (notification rules, scheduled tasks) there is no
 * user to ask, so "confirm" is treated as "deny". Notification text in
 * particular is written by other people and must never be able to trigger
 * a message, call, purchase or web request on its own.
 *
 * This file has no React Native imports so it can be unit-tested with Jest.
 */

export type SafetyContext =
  /** User is talking to Sanna right now (foreground pipeline). */
  | 'interactive'
  /** Triggered by an incoming notification – content is untrusted. */
  | 'notification'
  /** Triggered by a schedule the user created earlier. */
  | 'scheduled'
  /** Developer skill test from the settings screen. */
  | 'skill_test';

export type SafetyDecision =
  | { kind: 'allow' }
  | {
      kind: 'confirm';
      /** English summary (logs, LLM feedback, fallback). */
      summary: string;
      /** Locale key + params so the user sees it in their language. */
      messageKey?: string;
      params?: Record<string, string>;
    }
  | { kind: 'deny'; reason: string };

// ── Off-limits apps ───────────────────────────────────────────────────────

/**
 * Apps Sanna must never operate, open or automate. Exact package names.
 * Mirrored in SannaAccessibilityService.kt (native enforcement) – keep both
 * lists in sync.
 */
export const BLOCKED_PACKAGES: ReadonlySet<string> = new Set([
  // Android system / settings / installers
  'com.android.settings',
  'com.google.android.packageinstaller',
  'com.android.packageinstaller',
  'com.android.vending', // Play Store
  'com.google.android.gms', // Play services (account, security settings)
  'com.samsung.android.lool', // Samsung device care / security
  // Password managers & authenticators
  'com.google.android.apps.authenticator2',
  'com.azure.authenticator',
  'com.authy.authy',
  'com.x8bit.bitwarden',
  'com.onepassword.android',
  'com.lastpass.lpandroid',
  'com.dashlane',
  'keepass2android.keepass2android',
  'com.kunzisoft.keepass.free',
  'org.fedorahosted.freeotp',
  'com.beemdevelopment.aegis',
  // Payments & wallets
  'com.google.android.apps.walletnfcrel', // Google Wallet
  'com.google.android.apps.nbu.paisa.user', // Google Pay
  'com.paypal.android.p2pmobile',
  'com.venmo',
  'com.squareup.cash',
  'com.revolut.revolut',
  'com.transferwise.android',
  'com.coinbase.android',
  'com.binance.dev',
  'io.metamask',
  'com.samsung.android.spay',
]);

/**
 * Package-name fragments that mark an app as banking/finance even when it is
 * not on the exact list above (there are thousands of banking apps).
 */
const BLOCKED_PACKAGE_HINTS = [
  'bank',
  'banking',
  'wallet',
  'crypto',
  'authenticator',
  'password',
  'passwd',
  'vault',
  'broker',
  'trading',
];

export function isBlockedPackage(pkg: string | null | undefined): boolean {
  if (!pkg) return false;
  const p = pkg.trim().toLowerCase();
  if (BLOCKED_PACKAGES.has(p)) return true;
  return BLOCKED_PACKAGE_HINTS.some(h => p.includes(h));
}

// ── Web request allowlist ─────────────────────────────────────────────────

/**
 * Hosts the built-in skills talk to. A host matches if it equals an entry or
 * is a subdomain of it. Requests elsewhere need confirmation.
 */
export const ALLOWED_HTTP_HOSTS: readonly string[] = [
  'googleapis.com',
  'api.spotify.com',
  'accounts.spotify.com',
  'slack.com',
  'open-meteo.com',
  'nominatim.openstreetmap.org',
  'wikipedia.org',
  'api.duckduckgo.com',
  'api.search.brave.com',
  'itunes.apple.com',
  // News feeds used by the news skill
  'feeds.bbci.co.uk',
  'feeds.npr.org',
  'feeds.skynews.com',
  'apnews.com',
  'rss.dw.com',
  'rss.orf.at',
  'news.orf.at',
  'newsfeed.zeit.de',
  'diepresse.com',
];

/**
 * Where each saved credential may be sent. A credential is only ever attached
 * to a request whose host matches its list – otherwise a tricked LLM could
 * post your Google token to an attacker's server.
 */
export const CREDENTIAL_HOSTS: Readonly<Record<string, readonly string[]>> = {
  google: ['googleapis.com'],
  gmail: ['googleapis.com'],
  google_maps_api_key: ['googleapis.com'],
  spotify: ['api.spotify.com', 'accounts.spotify.com'],
  slack: ['slack.com'],
  brave_search_api_key: ['api.search.brave.com'],
};

export function hostOf(url: string): string | null {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : null;
}

function hostMatches(host: string, allowed: readonly string[]): boolean {
  return allowed.some(a => host === a || host.endsWith('.' + a));
}

export function isAllowedHost(host: string): boolean {
  return hostMatches(host, ALLOWED_HTTP_HOSTS);
}

// ── Intents ───────────────────────────────────────────────────────────────

/** Intent actions that place calls or send/share content. */
const SENSITIVE_INTENT_ACTIONS = new Set([
  'android.intent.action.CALL',
  'android.intent.action.DIAL',
  'android.intent.action.SENDTO',
  'android.intent.action.SEND',
  'android.intent.action.SEND_MULTIPLE',
  'android.intent.action.DELETE',
  'android.intent.action.UNINSTALL_PACKAGE',
  'android.intent.action.INSTALL_PACKAGE',
]);

/** URI schemes that call, message or pay. */
const SENSITIVE_URI_PREFIXES = [
  'tel:',
  'sms:',
  'smsto:',
  'mms:',
  'mmsto:',
  'mailto:',
  'whatsapp:',
  'https://wa.me/',
  'https://api.whatsapp.com/',
  'tg:',
  'upi:',
  'market:',
  'intent:',
];

// ── Helpers ───────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function clip(s: string, max = 120): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Replace {name} placeholders. Used for English summaries and translations. */
export function fillTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
}

/**
 * English templates for confirmation messages. The same keys exist in the
 * app's locale files (src/i18n/locales/*.ts) so the user hears/reads them in
 * their own language; English is the fallback and what the LLM sees.
 */
export const ACTION_TEMPLATES = {
  'safety.action.sms': 'Send SMS to {to}: "{text}"',
  'safety.action.email': 'Send email to {to}, subject "{subject}"',
  'safety.action.call': 'Call {to}',
  'safety.action.share': 'Open {app} to send or share: {target}',
  'safety.action.screen': 'Control {app} to: {goal}',
  'safety.action.web': 'Send a web request ({method}) to {host}',
  'safety.action.webWrite': '{method} request to {host}: {url}',
  'safety.action.rule': 'Create a rule for {app} notifications: "{instruction}"',
  'safety.action.ruleChange': 'Change notification rule: "{instruction}"',
  'safety.action.autoReply':
    'Turn on AUTO-REPLY for {app}. Sanna will answer these messages by itself, without asking you each time. Rule: "{instruction}"',
  'safety.action.schedule': 'Schedule: "{instruction}"',
  'safety.action.scheduleChange': 'Change schedule: "{instruction}"',
} as const;

export type ActionKey = keyof typeof ACTION_TEMPLATES;

function confirm(key: ActionKey, params: Record<string, string>): SafetyDecision {
  return {
    kind: 'confirm',
    summary: fillTemplate(ACTION_TEMPLATES[key], params),
    messageKey: key,
    params,
  };
}

const ALLOW: SafetyDecision = { kind: 'allow' };

/** Tool that replies through the notification's own Reply button. */
export const REPLY_TOOL_NAME = 'reply_to_notification';

// ── The policy ────────────────────────────────────────────────────────────

/**
 * Classify a tool call, ignoring context. Context (background vs. foreground)
 * is applied in evaluate().
 */
export function classifyToolCall(
  toolName: string,
  args: Record<string, unknown>,
): SafetyDecision {
  switch (toolName) {
    case 'send_sms':
      return confirm('safety.action.sms', {
        to: str(args.phone_number),
        text: clip(str(args.message)),
      });

    case 'gmail_send':
      return confirm('safety.action.email', {
        to: str(args.to),
        subject: clip(str(args.subject), 60),
      });

    case 'intent': {
      const action = str(args.action);
      const uri = str(args.uri);
      const pkg = str(args.package);
      if (isBlockedPackage(pkg)) {
        return { kind: 'deny', reason: `Opening ${pkg} is not allowed (off-limits app).` };
      }
      const lowerUri = uri.toLowerCase();
      if (
        SENSITIVE_INTENT_ACTIONS.has(action) ||
        SENSITIVE_URI_PREFIXES.some(p => lowerUri.startsWith(p))
      ) {
        if (lowerUri.startsWith('tel:') || action.endsWith('.CALL') || action.endsWith('.DIAL')) {
          return confirm('safety.action.call', { to: uri.replace(/^tel:/i, '') });
        }
        return confirm('safety.action.share', {
          app: pkg || 'an app',
          target: clip(uri || action),
        });
      }
      if (action.endsWith('.SETTINGS') || action.startsWith('android.settings.')) {
        return { kind: 'deny', reason: 'Opening system settings is not allowed.' };
      }
      return ALLOW;
    }

    case 'accessibility': {
      const pkg = str(args.package_name);
      if (isBlockedPackage(pkg)) {
        return {
          kind: 'deny',
          reason: `Controlling ${pkg} is not allowed (banking, payment, password and system apps are off-limits).`,
        };
      }
      return confirm('safety.action.screen', { app: pkg, goal: clip(str(args.goal), 160) });
    }

    case 'http': {
      const method = (str(args.method) || 'GET').toUpperCase();
      const url = str(args.url);
      const host = hostOf(url);
      const authProvider = str(args.auth_provider);
      if (!host) {
        return { kind: 'deny', reason: 'Only http(s) URLs are allowed.' };
      }
      if (url.toLowerCase().startsWith('http://')) {
        return { kind: 'deny', reason: 'Unencrypted http:// requests are not allowed. Use https://.' };
      }
      if (authProvider) {
        const allowedForCred = CREDENTIAL_HOSTS[authProvider];
        if (!allowedForCred || !hostMatches(host, allowedForCred)) {
          return {
            kind: 'deny',
            reason: `Credential "${authProvider}" may not be sent to ${host}.`,
          };
        }
      }
      if (!isAllowedHost(host)) {
        return confirm('safety.action.web', { method, host });
      }
      if (method !== 'GET') {
        return confirm('safety.action.webWrite', { method, host, url: clip(url, 80) });
      }
      return ALLOW;
    }

    case 'notifications': {
      const action = str(args.action);
      const instruction = clip(str(args.instruction) || str(args.rule_id));
      if ((action === 'subscribe' || action === 'update_rule') && args.auto_reply === true) {
        return confirm('safety.action.autoReply', {
          app: str(args.app) || str(args.rule_id),
          instruction,
        });
      }
      if (action === 'subscribe') {
        return confirm('safety.action.rule', { app: str(args.app), instruction });
      }
      if (
        action === 'update_rule' &&
        (args.instruction != null || args.condition != null || args.enabled === true)
      ) {
        return confirm('safety.action.ruleChange', { instruction });
      }
      return ALLOW; // reading, disabling, deleting, turning auto-reply OFF are safe
    }

    case 'scheduler': {
      const action = str(args.action);
      if (action === 'create' || action === 'update' || action === 'enable') {
        const instruction = clip(
          str(args.instruction) || str(args.label) || str(args.schedule_id),
        );
        return confirm(
          action === 'create' ? 'safety.action.schedule' : 'safety.action.scheduleChange',
          { instruction },
        );
      }
      return ALLOW;
    }

    case REPLY_TOOL_NAME:
      // Context-dependent – see evaluate().
      return { kind: 'deny', reason: 'Auto-reply only works inside a notification rule.' };

    default:
      return ALLOW;
  }
}

/**
 * Final decision for a tool call in a given context.
 */
export function evaluate(
  context: SafetyContext,
  toolName: string,
  args: Record<string, unknown>,
): SafetyDecision {
  // Auto-reply: the user switched it on per rule (with confirmation) ahead of
  // time. The reply tool itself checks that the matched rule has auto-reply
  // on, enforces a rate limit, and can only answer the chat that sent the
  // notification – it has no recipient parameter at all.
  if (toolName === REPLY_TOOL_NAME) {
    return context === 'notification'
      ? ALLOW
      : { kind: 'deny', reason: 'Auto-reply only works inside a notification rule.' };
  }

  const d = classifyToolCall(toolName, args);
  if (d.kind !== 'confirm') return d;

  if (context === 'interactive') return d;

  // Background: nobody to ask.
  return {
    kind: 'deny',
    reason:
      `"${d.summary}" needs the user's confirmation and cannot run in the background` +
      (context === 'notification'
        ? ' (it was triggered by an incoming notification, which may have been written by someone else).'
        : '.') +
      ' Do not retry. Tell the user what you wanted to do so they can do it themselves.',
  };
}

// ── Voice confirmation parsing ─────────────────────────────────────────────

const YES_WORDS = [
  // en
  'yes', 'yeah', 'yep', 'sure', 'confirm', 'do it', 'go ahead', 'okay', 'ok',
  // de
  'ja', 'jawohl', 'mach', 'bestätigen',
  // es / pt / it / fr
  'sí', 'si', 'sim', 'claro', 'oui', "d'accord", 'certo', 'vale',
  // he
  'כן', 'בטח', 'אישור', 'סבבה',
  // ru / uk
  'да', 'так',
  // ar
  'نعم', 'أجل', 'ايوه',
];

const NO_WORDS = [
  'no', 'nope', 'cancel', 'stop', "don't", 'do not', 'abort',
  'nein', 'abbrechen', 'nicht',
  'não', 'nao', 'non', 'annulla', 'annuler', 'cancelar',
  'לא', 'ביטול', 'בטל',
  'нет', 'ні', 'отмена',
  'لا', 'إلغاء',
];

function containsWord(text: string, word: string): boolean {
  // Whole-word check that works for Hebrew/Arabic/Cyrillic too (\b does not),
  // without relying on Unicode regex classes the JS engine may lack.
  const tokens = text.split(/[\s.,!?;:"()[\]\-–—¿¡،؟]+/).filter(Boolean);
  return (' ' + tokens.join(' ') + ' ').includes(' ' + word + ' ');
}

/**
 * Interpret a spoken answer. Any "no" word wins over "yes" words, and
 * anything unclear is treated as "no" – a misheard answer must never
 * send a message.
 */
export function parseSpokenConfirmation(transcript: string): boolean {
  const t = transcript.trim().toLowerCase();
  if (!t) return false;
  if (NO_WORDS.some(w => containsWord(t, w))) return false;
  return YES_WORDS.some(w => containsWord(t, w));
}

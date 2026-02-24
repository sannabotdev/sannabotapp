/**
 * NotificationRulesStore – Shared storage for notification rules
 *
 * Rules define what the sub-agent should do when a notification arrives.
 * Each rule has:
 *   - An app (package name) – cheap native-level filter
 *   - An instruction (what the sub-agent should execute)
 *   - An optional condition (natural language – evaluated by the LLM)
 *
 * Filtering logic:
 *   1. The Android NotificationListenerService forwards only notifications
 *      from subscribed package names (derived from enabled rules).
 *   2. On the JS side, all enabled rules for that app are passed to a
 *      single sub-agent which uses the LLM to evaluate each rule's
 *      condition and execute the first matching instruction.
 *
 * The unique set of package names from all enabled rules is synced
 * to the native NotificationListenerService so Android knows which
 * apps to forward.
 *
 * Persistence: AsyncStorage (key "sanna_notification_rules"), which is
 * included in Google Auto Backup via backup_rules.xml.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotificationListenerModule } from '../native/NotificationListenerModule';

const STORAGE_KEY = 'sanna_notification_rules';

// ── Data model ───────────────────────────────────────────────────────────────

export interface NotificationRule {
  /** Unique rule ID */
  id: string;
  /** Android package name (e.g. "com.whatsapp") */
  app: string;
  /** Human-readable app label (e.g. "WhatsApp") */
  appLabel: string;
  /** Whether the rule is active */
  enabled: boolean;
  /**
   * Natural-language instruction for the sub-agent (like scheduler).
   * Example: "Read the message aloud via TTS"
   */
  instruction: string;
  /**
   * Optional natural-language condition evaluated by the LLM.
   * If empty, the rule always matches for its app.
   * Example: "The sender is my team lead" or "The message mentions 'urgent'"
   */
  condition: string;
  /** When the rule was created */
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Store API ────────────────────────────────────────────────────────────────

/**
 * Load all notification rules from storage.
 */
export async function loadRules(): Promise<NotificationRule[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) { return []; }
    return JSON.parse(json) as NotificationRule[];
  } catch {
    return [];
  }
}

/**
 * Persist all rules to storage and sync the package-name allowlist
 * to the native Android NotificationListenerService.
 */
export async function saveRules(rules: NotificationRule[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  await syncNativeAllowlist(rules);
}

/**
 * Create a new rule and persist it.
 * Returns the created rule.
 */
export async function addRule(
  partial: Omit<NotificationRule, 'id' | 'created_at'>,
): Promise<NotificationRule> {
  const rules = await loadRules();
  const rule: NotificationRule = {
    ...partial,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  rules.push(rule);
  await saveRules(rules);
  return rule;
}

/**
 * Update an existing rule (by id). Merges the provided fields.
 */
export async function updateRule(
  id: string,
  updates: Partial<Pick<NotificationRule, 'instruction' | 'condition' | 'enabled'>>,
): Promise<NotificationRule | null> {
  const rules = await loadRules();
  const idx = rules.findIndex(r => r.id === id);
  if (idx === -1) { return null; }
  rules[idx] = { ...rules[idx], ...updates };
  await saveRules(rules);
  return rules[idx];
}

/**
 * Delete a rule by id.
 */
export async function deleteRule(id: string): Promise<boolean> {
  const rules = await loadRules();
  const before = rules.length;
  const filtered = rules.filter(r => r.id !== id);
  if (filtered.length === before) { return false; }
  await saveRules(filtered);
  return true;
}

/**
 * Delete ALL rules for a given package name.
 */
export async function deleteRulesForApp(packageName: string): Promise<number> {
  const rules = await loadRules();
  const remaining = rules.filter(r => r.app !== packageName);
  const removed = rules.length - remaining.length;
  if (removed > 0) { await saveRules(remaining); }
  return removed;
}

/**
 * Get all enabled rules for a given package name.
 * These are the candidate rules that will be evaluated by the LLM.
 */
export function getRulesForApp(
  rules: NotificationRule[],
  packageName: string,
): NotificationRule[] {
  return rules.filter(r => r.enabled && r.app === packageName);
}

/**
 * Sync the native allowlist from persisted rules.
 * Call this on app startup to ensure the native side matches the rules
 * (e.g. after a backup restore or app update).
 */
export async function syncOnStartup(): Promise<void> {
  const rules = await loadRules();
  await syncNativeAllowlist(rules);
}

// ── Native sync ──────────────────────────────────────────────────────────────

/**
 * Sync the unique set of package names from all enabled rules to the
 * native NotificationListenerService's allowlist.
 */
async function syncNativeAllowlist(rules: NotificationRule[]): Promise<void> {
  const mod = getNotificationListenerModule();
  if (!mod) { return; }

  const enabledApps = [...new Set(
    rules.filter(r => r.enabled).map(r => r.app),
  )];
  await mod.setSubscribedApps(JSON.stringify(enabledApps));
}

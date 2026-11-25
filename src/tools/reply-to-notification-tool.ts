/**
 * ReplyToNotificationTool – auto-reply to the message that triggered a rule.
 *
 * Safety design:
 *  - Only registered for the notification sub-agent, and only when at least
 *    one of the rules for this app has auto-reply turned on (which the user
 *    had to confirm).
 *  - No recipient parameter. The reply goes through the notification's own
 *    Reply button, so it can only reach the chat that sent the message.
 *  - The rule the LLM names must have auto-reply on.
 *  - Rate limit per chat, so two auto-responders can't loop forever and a
 *    stranger can't use Sanna to spam replies.
 *  - One reply per notification.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import type { NotificationRule } from '../agent/notification-rules-store';
import { getNotificationListenerModule } from '../native/NotificationListenerModule';
import { REPLY_TOOL_NAME } from '../security/safety-policy';

const RATE_KEY = 'sanna_auto_reply_log';
export const MAX_REPLIES_PER_CHAT_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;
const MAX_REPLY_CHARS = 500;

type ReplyLog = Record<string, number[]>;

/** Pure helper (tested): may this chat get another auto-reply now? */
export function underRateLimit(timestamps: number[], now: number): boolean {
  return timestamps.filter(ts => now - ts < HOUR_MS).length < MAX_REPLIES_PER_CHAT_PER_HOUR;
}

export interface ReplyTarget {
  notificationKey: string;
  packageName: string;
  sender: string;
}

export class ReplyToNotificationTool implements Tool {
  private used = false;

  constructor(
    private readonly target: ReplyTarget,
    private readonly rules: NotificationRule[],
  ) {}

  name(): string {
    return REPLY_TOOL_NAME;
  }

  description(): string {
    return (
      'Reply to the incoming message that triggered this rule, via the notification\'s Reply button. ' +
      'The reply always goes back to the same chat – you cannot choose another recipient. ' +
      'Only works for rules with auto-reply ON. One reply per message. ' +
      'Keep replies short and never include private information about the user.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        rule_id: {
          type: 'string',
          description: 'ID of the rule you are executing (must have auto-reply ON).',
        },
        text: {
          type: 'string',
          description: `Reply text (max ${MAX_REPLY_CHARS} characters).`,
        },
      },
      required: ['rule_id', 'text'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const ruleId = String(args.rule_id ?? '');
    const text = String(args.text ?? '').trim().slice(0, MAX_REPLY_CHARS);

    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule || !rule.enabled || !rule.autoReply) {
      return errorResult(
        'Auto-reply is not turned on for this rule. Do not reply; tell the user about the message instead.',
      );
    }
    if (!text) return errorResult('Reply text is empty.');
    if (this.used) return errorResult('Already replied to this message. Only one reply per message.');

    const mod = getNotificationListenerModule();
    if (!mod) return errorResult('Notification replies are not available on this device.');

    // Rate limit per chat
    const chatKey = `${this.target.packageName}|${this.target.sender}`;
    const now = Date.now();
    let log: ReplyLog = {};
    try {
      log = JSON.parse((await AsyncStorage.getItem(RATE_KEY)) ?? '{}') as ReplyLog;
    } catch {
      log = {};
    }
    const recent = (log[chatKey] ?? []).filter(ts => now - ts < HOUR_MS);
    if (!underRateLimit(recent, now)) {
      return errorResult(
        `Auto-reply limit reached for this chat (${MAX_REPLIES_PER_CHAT_PER_HOUR} per hour). Do not reply; just tell the user.`,
      );
    }

    try {
      await mod.replyToNotification(this.target.notificationKey, text);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    this.used = true;
    log[chatKey] = [...recent, now];
    // Drop chats with no recent replies so the log doesn't grow forever.
    for (const k of Object.keys(log)) {
      if (!log[k].some(ts => now - ts < HOUR_MS)) delete log[k];
    }
    try {
      await AsyncStorage.setItem(RATE_KEY, JSON.stringify(log));
    } catch {
      /* best effort */
    }

    return successResult(
      `Auto-replied to ${this.target.sender}: "${text}"`,
      `Auto-replied to ${this.target.sender}`,
    );
  }
}

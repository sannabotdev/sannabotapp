---
name: notifications
category: information
description: Create notification rules – a sub-agent executes any instruction when a matching notification arrives
test_prompt: List all notification rules
exclusive_tool: notifications
permissions:
---
# Notifications Skill

Create rules for incoming notifications. When a notification from a subscribed app arrives, an independent sub-agent (mini AI) evaluates the rule conditions and executes the matching instruction with all available tools. This works exactly like the scheduler, but triggered by notifications instead of time.

**Examples**: Read messages aloud, auto-reply to specific people, summarise emails, play alarm on urgent messages.

## Tool: notifications

### Create a notification rule (subscribe)

```json
{
  "action": "subscribe",
  "app": "whatsapp",
  "instruction": "Read the message aloud via the tts tool."
}
```

The `instruction` is the command the sub-agent will execute when a matching notification arrives. Write it as if you were giving Sanna the command directly. The sub-agent has access to all tools (TTS, WhatsApp, SMS, Gmail, etc.).

**IMPORTANT**: The instruction must contain everything the sub-agent needs. It has no context of the current conversation.

### Subscribe with a condition

```json
{
  "action": "subscribe",
  "app": "whatsapp",
  "instruction": "Reply via WhatsApp with 'OK, I'm on my way!'",
  "condition": "The sender is my partner"
}
```

The `condition` is a natural-language description evaluated by the LLM against the incoming notification. If the condition matches, the instruction is executed. If no condition is set, the rule is a catch-all that applies to every notification from that app.

Multiple rules can exist for the same app. Conditional rules are evaluated first; catch-all rules serve as fallbacks.

### More examples

#### Read all emails aloud
```json
{
  "action": "subscribe",
  "app": "email",
  "instruction": "Briefly announce this email via TTS: who sent it and what is the subject."
}
```

#### Read detailed content for emails from a specific person
```json
{
  "action": "subscribe",
  "app": "email",
  "instruction": "Read the full email content aloud via TTS, including sender, subject, and message body. Look up the email via Gmail if needed.",
  "condition": "The sender is my team lead or my boss"
}
```

#### Play alarm on urgent Slack messages
```json
{
  "action": "subscribe",
  "app": "slack",
  "instruction": "Play an alarm sound with the beep tool (tone: alarm, count: 3), then read the message aloud via TTS.",
  "condition": "The message mentions something urgent or is marked as important"
}
```

#### Auto-reply to a specific contact on WhatsApp
```json
{
  "action": "subscribe",
  "app": "whatsapp",
  "instruction": "Reply via WhatsApp to the sender with 'I'm driving, I'll call you back later.'",
  "condition": "The sender is a family member"
}
```

#### Silently log Telegram (no announcement)
```json
{
  "action": "subscribe",
  "app": "telegram",
  "instruction": "Do nothing. Simply confirm silently that the notification was received."
}
```

### Unsubscribe from an app (remove all rules)

```json
{
  "action": "unsubscribe",
  "app": "email"
}
```

This removes ALL rules for that app.

### Update an existing rule

```json
{
  "action": "update_rule",
  "rule_id": "{ID}",
  "instruction": "New instruction text"
}
```

You can update `instruction`, `condition`, or `enabled` status. Get IDs via `list_subscriptions`.

### Delete a specific rule

```json
{
  "action": "delete_rule",
  "rule_id": "{ID}"
}
```

### Show all rules

```json
{
  "action": "list_subscriptions"
}
```

### Fetch recent notifications

```json
{
  "action": "get_recent"
}
```

Optionally filter by app:

```json
{
  "action": "get_recent",
  "filter_app": "whatsapp"
}
```

### Clear notification buffer

```json
{
  "action": "clear"
}
```

Supported app aliases: `whatsapp`, `email`, `gmail`, `telegram`, `signal`, `sms`, `instagram`, `facebook`, `messenger`, `twitter`, `slack`, `discord`, `teams`, `outlook`, `calendar`

Or use the package name directly: `"app": "com.whatsapp"`

## Writing instructions

The sub-agent is a standalone agent with no conversation context. The instruction must be self-explanatory:

**Good**:
- `"Read the message aloud via the tts tool"`
- `"Reply via WhatsApp with 'OK, I'm on my way!'"`
- `"Play an alarm sound (beep tool, tone: alarm, count: 5), then read the message via TTS"`
- `"Look up the full email via Gmail and read it aloud"`
- `"Send an SMS to +4366012345678 with the content of this notification"`

**Bad**:
- `"Read it"` (Read what? Too vague for a background agent.)
- `"Reply to them"` (Who? What should the reply say? No conversation context.)

## Workflows

### "Read new WhatsApp messages to me"

1. `notifications`: `subscribe` with `app: "whatsapp"`, `instruction: "Read the message aloud via the tts tool."`
2. Confirm to the user.

### "When a specific person writes on WhatsApp, reply automatically"

1. `notifications`: `subscribe` with `app: "whatsapp"`, `condition: "The sender is <person>"`, `instruction: "Reply via WhatsApp to the sender with '<message>'"`
2. Confirm to the user.

### "Stop WhatsApp notifications"

1. `notifications`: `unsubscribe` with `app: "whatsapp"`
2. Confirm: all rules removed.

### "What notification rules do I have?"

1. `notifications`: `list_subscriptions`
2. Report the rules (describe by app, condition, and instruction — never by ID)

### "Change the auto-reply text"

1. `notifications`: `list_subscriptions` → find the relevant rule
2. `notifications`: `update_rule` with the found rule ID and new instruction

### "Delete the rule for urgent Slack messages"

1. `notifications`: `list_subscriptions` → find the rule
2. `notifications`: `delete_rule` with the ID

### "Read me the latest messages"

1. `notifications`: `get_recent`
2. Summarise notifications
3. Read aloud via TTS (automatically in driving mode, otherwise on request)

## How it works (sub-agent architecture)

When a notification arrives from a subscribed app:

1. The Android service captures the notification and emits it to the app
2. The app loads all enabled rules for that app
3. An **independent sub-agent** is started with the notification data and ALL matching rules
4. The LLM evaluates each rule's condition against the notification content
5. The sub-agent executes the instruction of the first matching rule
6. The sub-agent has access to ALL tools (TTS, WhatsApp, SMS, Gmail, beep, etc.)
7. Multiple notifications are queued and processed sequentially
8. The main pipeline stays free for user interaction at all times
9. Notifications are also stored in the buffer for later retrieval with `get_recent`

### Condition evaluation (by the LLM)

- Conditions are natural-language descriptions, evaluated semantically by the LLM
- This means conditions like "The sender is a colleague" or "The message is about a meeting" work even without exact text matches
- Conditional rules are evaluated before catch-all rules
- Only the first matching rule is executed per notification
- If no rule matches at all, the notification is silently skipped

## Permissions

**Important**: The user must manually enable "Notification access" for Sanna in the Android settings.

1. Open Android Settings
2. Go to "Apps" → "Special app access" → "Notification access"
3. Enable Sanna

The app shows the current status in Settings along with a button to open the system settings.

## Important rules

- **Never show rule IDs**: Rule IDs are internal. When talking to the user, describe rules by their app, condition, and instruction (e.g. "your WhatsApp auto-reply rule"), never by ID.
- **Self-contained instructions**: The sub-agent has no conversation context. Include all necessary details in the instruction.
- **Multiple rules per app**: You can create multiple rules with different conditions for the same app.
- **Condition priority**: Conditional rules are always evaluated before catch-all rules.
- Notifications are only captured if Notification Access is granted.
- Notifications are stored in a buffer (max 50).
- The sub-agent has the same tools as the main app (except the scheduler).
- Additional apps can be subscribed via their full package name (e.g. `com.example.app`).

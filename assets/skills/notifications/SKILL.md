---
name: notifications
description: Subscribe to, summarise and read aloud notifications from apps (WhatsApp, Email, Telegram, etc.)
test_prompt: List all subscribed apps for notifications
permissions:
---
# Notifications Skill

Manages notifications from apps and allows them to be summarised and read aloud.

## Tool: notifications

Use the `notifications` tool for all notification operations.

### Subscribe to an app

```json
{
  "action": "subscribe",
  "app": "whatsapp"
}
```

Supported app aliases: `whatsapp`, `email`, `gmail`, `telegram`, `signal`, `sms`, `instagram`, `facebook`, `messenger`, `twitter`, `slack`, `discord`, `teams`, `outlook`, `calendar`

Or use the package name directly: `"app": "com.whatsapp"`

### Unsubscribe from an app

```json
{
  "action": "unsubscribe",
  "app": "email"
}
```

### Show all subscriptions

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

## Workflows

### "Read new WhatsApp messages to me as they arrive"

1. `notifications`: `subscribe` with `app: "whatsapp"`
2. Confirm: "I will now read new WhatsApp messages aloud to you"

**Important**: The user must first enable "Notification access" for Sanna in the Android settings.

### "Ignore new emails"

1. `notifications`: `unsubscribe` with `app: "email"`
2. Confirm: "I will now ignore new emails"

### "Which notifications do I receive?"

1. `notifications`: `list_subscriptions`
2. Output list of subscribed apps

### "Read me the latest messages"

1. `notifications`: `get_recent`
2. Summarise notifications
3. Read aloud via TTS (automatically in driving mode, otherwise on request)

### "What's new in WhatsApp?"

1. `notifications`: `get_recent` with `filter_app: "whatsapp"`
2. Summary of WhatsApp notifications
3. Read aloud via TTS

### "Stop WhatsApp notifications"

1. `notifications`: `unsubscribe` with `app: "whatsapp"`
2. Confirm: "I will no longer read WhatsApp messages aloud"

## Real-time notifications

When a notification arrives from a subscribed app:

1. The app captures the notification automatically
2. If the pipeline is idle: summarise and read aloud via TTS
3. If the pipeline is busy: notification is buffered and can be retrieved later with `get_recent`

## Permissions

**Important**: The user must manually enable "Notification access" for Sanna in the Android settings.

1. Open Android Settings
2. Go to "Apps" → "Special app access" → "Notification access"
3. Enable Sanna

The app shows the current status in Settings along with a button to open the system settings.

## Supported apps

- **Messaging**: WhatsApp, Telegram, Signal, SMS
- **Email**: Gmail, Outlook
- **Social Media**: Instagram, Facebook, Messenger, Twitter
- **Business**: Slack, Discord, Teams

Additional apps can be subscribed to via their full package name (e.g. `com.example.app`).

## Notes

- Notifications are only captured if Notification Access is granted and the app has been subscribed
- Notifications are stored in a buffer (max. 50)
- In driving mode, new notifications are read aloud automatically

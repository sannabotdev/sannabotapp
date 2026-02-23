---
name: slack
description: Read, send and manage Slack messages and channels via the Slack API
test_prompt: List the last 3 messages from the General channel
android_package: com.Slack
permissions:
 - android.permission.INTERNET
credentials:
 - id: slack_credentials
   label: Slack Workspace
   type: oauth
   auth_provider: slack
---
# Slack Skill

Read and send messages in Slack channels and direct messages.

## Voice control: Recognising channel names

Users speak channel names **without `#`** – this is normal and expected.

| User says | Means |
|---|---|
| "the general channel" | `#general` |
| "in the project channel" | `#project` |
| "the random channel" | `#random` |
| "in the dev channel" | `#dev` / `#development` |

**Important:** Match the spoken name against `conversations.list` – find the channel whose `name` is closest to the spoken term (substring match, case-insensitive). If multiple channels match, ask: "Do you mean the channel 'project-alpha' or 'project-beta'?"

## Tool: http

All requests require `auth_provider: "slack"`.

Base URL: `https://slack.com/api`

### List channels

```json
{
  "method": "GET",
  "url": "https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=50",
  "auth_provider": "slack"
}
```

Returns `channels` – each element has `id`, `name` and `is_member`.

### Read messages from a channel

```json
{
  "method": "GET",
  "url": "https://slack.com/api/conversations.history?channel={CHANNEL_ID}&limit=10",
  "auth_provider": "slack"
}
```

`{CHANNEL_ID}` e.g. `C01234ABCDE`. Returns `messages`, newest first.

### Read thread replies

```json
{
  "method": "GET",
  "url": "https://slack.com/api/conversations.replies?channel={CHANNEL_ID}&ts={THREAD_TS}&limit=20",
  "auth_provider": "slack"
}
```

`{THREAD_TS}` = timestamp of the parent message (e.g. `1713000000.000100`).

### Open direct message (DM) / get channel ID for DM

```json
{
  "method": "POST",
  "url": "https://slack.com/api/conversations.open",
  "auth_provider": "slack",
  "body": {
    "users": "{USER_ID}"
  }
}
```

Returns `channel.id` – use this ID for `chat.postMessage`.

### Send a message to a channel

```json
{
  "method": "POST",
  "url": "https://slack.com/api/chat.postMessage",
  "auth_provider": "slack",
  "body": {
    "channel": "{CHANNEL_ID}",
    "text": "{MESSAGE_TEXT}"
  }
}
```

### Reply to a message (in thread)

```json
{
  "method": "POST",
  "url": "https://slack.com/api/chat.postMessage",
  "auth_provider": "slack",
  "body": {
    "channel": "{CHANNEL_ID}",
    "text": "{REPLY_TEXT}",
    "thread_ts": "{TIMESTAMP_OF_ORIGINAL_MESSAGE}"
  }
}
```

### Search for a user (by name or email)

```json
{
  "method": "GET",
  "url": "https://slack.com/api/users.lookupByEmail?email={EMAIL}",
  "auth_provider": "slack"
}
```

Or list all users:

```json
{
  "method": "GET",
  "url": "https://slack.com/api/users.list?limit=50",
  "auth_provider": "slack"
}
```

Returns `members` – each element has `id`, `name`, `real_name` and `profile.display_name`.

### Get own profile / current user ID

```json
{
  "method": "GET",
  "url": "https://slack.com/api/auth.test",
  "auth_provider": "slack"
}
```

Returns `user_id`, `user` (name) and `team` (workspace name) among others.

### Set status

```json
{
  "method": "POST",
  "url": "https://slack.com/api/users.profile.set",
  "auth_provider": "slack",
  "body": {
    "profile": {
      "status_text": "{STATUS_TEXT}",
      "status_emoji": "{EMOJI}",
      "status_expiration": 0
    }
  }
}
```

Example emojis: `:car:`, `:palm_tree:`, `:calendar:`, `:no_entry_sign:`  
`status_expiration`: Unix timestamp (0 = no expiry).

### Clear status

```json
{
  "method": "POST",
  "url": "https://slack.com/api/users.profile.set",
  "auth_provider": "slack",
  "body": {
    "profile": {
      "status_text": "",
      "status_emoji": "",
      "status_expiration": 0
    }
  }
}
```

### Get channel details

```json
{
  "method": "GET",
  "url": "https://slack.com/api/conversations.info?channel={CHANNEL_ID}",
  "auth_provider": "slack"
}
```

## Workflow: Read messages aloud

1. Match spoken channel name against `conversations.list` (substring match on `name`)
2. Call `conversations.history` with `limit=5`
3. For each message: resolve `user` ID to real name using `users.list`
4. Read aloud with `tts`: "{Name} writes: {Text}" – omit timestamps

## Workflow: Send a message (by voice)

1. Match spoken channel name against `conversations.list`  
   → If no match: ask "Which channel do you mean?" via TTS
2. Extract message text from voice command
3. Confirm via TTS: "Shall I write in {channel-name}: {text}?"
4. After confirmation: send `chat.postMessage`
5. Confirmation: "Sent."

## Workflow: Send a DM (by voice)

1. Match spoken first name against `users.list` (`real_name` or `display_name`, substring match)  
   → If multiple matches: ask "Do you mean {Name A} or {Name B}?"
2. `conversations.open` with the `user_id` → get DM channel ID
3. Confirm: "Shall I write to {first name}: {text}?"
4. Send after confirmation
5. Confirmation: "Message sent to {first name}."

## Workflow: Set status while driving

1. `users.profile.set` with `status_text: "On the road"`, `status_emoji: ":car:"`
2. Confirm via TTS: "Your Slack status has been set to On the road."

## Error handling

Every Slack API response contains `"ok": true/false`. If `"ok": false`, the `"error"` field contains the error code:

- `not_in_channel` → Join the channel first (`conversations.join`)
- `channel_not_found` → Search for channel ID again via `conversations.list`
- `missing_scope` → OAuth scope missing (user must re-authorize the app)

## Examples

- "Read me the latest messages from the general channel" → `conversations.list` → match `general` → `conversations.history` → TTS
- "What's new in the project channel?" → channel match → `conversations.history` → TTS summary
- "Write to Max on Slack: Be right there" → match user "Max" → open DM → send
- "Write in the general channel: I'm sick today" → channel match → confirmation → send
- "Reply to the last message from Julia" → get history → get `thread_ts` → `chat.postMessage` with `thread_ts`
- "Set my Slack status to vacation" → `users.profile.set` with `:palm_tree:`
- "Clear my Slack status" → `users.profile.set` with empty fields

## Notes

- Channel names are spoken **without `#`** – always match via `conversations.list` (substring match)
- In TTS output speak channel names without `#`: "the general channel", not "hashtag general"
- Timestamps (`ts`) are strings in format `"1713000000.000100"` – copy them exactly
- Maximum sensible number of messages to read aloud: 5
- Always ask for confirmation before sending

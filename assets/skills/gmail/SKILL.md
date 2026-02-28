---
name: gmail
category: communication
description: Read, search and send emails via Gmail API
test_prompt: Fetch the last 3 emails from the inbox and return sender and subject
permissions:
 - android.permission.INTERNET
credentials:
 - id: google_credentials
   label: Google Account
   type: oauth
   auth_provider: google
exclusive_tool: gmail_send
---
# Gmail Skill

Read and send emails via the Gmail API.

## Tool: gmail_send

**✅ RECOMMENDED for sending emails** - Only available when Gmail is enabled and configured.

The `gmail_send` tool automatically handles email formatting and encoding. Simply provide email parameters (to, subject, body, etc.) and the tool handles the rest. See the "Send email" section below for details.

## Tool: http

All requests require `auth_provider: "google"`.

**For sending emails:** Use the `gmail_send` tool (see above).

### Gmail categories (labels)

Gmail sorts emails into categories. Not all accounts have the same category labels. Common label IDs:
- `CATEGORY_PRIMARY` or `CATEGORY_PERSONAL` - Important, personal emails (the main inbox tab). **Which one exists varies by account.**
- `CATEGORY_SOCIAL` - Social network notifications
- `CATEGORY_PROMOTIONS` - Marketing, newsletters, deals
- `CATEGORY_UPDATES` - Automated notifications, confirmations, receipts
- `CATEGORY_FORUMS` - Mailing lists, discussion groups
- `IMPORTANT` - Emails Gmail considers important (can overlap with any category)

### Fetch recent emails (default - primary/personal)

Use `q=category:primary` to reliably filter for important emails regardless of which label the account uses:

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=category:primary",
  "auth_provider": "google"
}
```

**Fallback:** If the above returns 0 results, fall back to fetching from `INBOX` without category filter:

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX",
  "auth_provider": "google"
}
```

### Fetch emails from other categories

Only when the user explicitly asks for promotions, social, updates, etc.:

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=category:promotions",
  "auth_provider": "google"
}
```

Replace `promotions` with `social`, `updates`, or `forums` as needed.

### Read email details

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages/{MESSAGE_ID}?format=full",
  "auth_provider": "google"
}
```

### Search emails

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?q={SEARCH_TERM}&maxResults=5",
  "auth_provider": "google"
}
```

Example search terms:
- `from:boss@company.com` - From a specific person
- `subject:Meeting` - Subject contains "Meeting"
- `is:unread` - Unread emails
- `newer_than:1d` - Emails from the last 24 hours
- `newer_than:7d` - Emails from the last 7 days
- `newer_than:1m` - Emails from the last month
- `newer_than:1y` - Emails from the last year
- `older_than:5d` - Emails older than 5 days
- `after:1388552400` - After a date/time (Unix timestamp in seconds). Use `device` tool with `get_date_timestamp` action to calculate timestamps.
- `before:1391230800` - Before a date/time (Unix timestamp in seconds)
- `after:2024/01/01` - After a date (YYYY/MM/DD, uses PST - may miss emails in other timezones)
- `before:2024/01/31` - Before a date (YYYY/MM/DD, uses PST)
- `category:primary` - Primary/personal emails only
- `category:promotions` - Promotions only

### Date filtering

**For accurate timezone handling, use Unix timestamps with the `device` tool:**

Use `device` tool with `get_date_timestamp` action to get Unix timestamps in local timezone:

```json
{
  "action": "get_date_timestamp",
  "date": "today",
  "unit": "seconds"
}
```

**Available date values:**
- `"today"` - Midnight of today in local timezone
- `"yesterday"` - Midnight of yesterday in local timezone
- `"tomorrow"` - Midnight of tomorrow in local timezone
- `"YYYY-MM-DD"` - Specific date (e.g., `"2024-12-20"`)

**Optional parameters:**
- `time`: `"HH:MM:SS"` format (default: `"00:00:00"` for midnight)
- `unit`: `"seconds"` (default) or `"milliseconds"`

**Date filtering examples:**
- "What emails did I receive today?" -> Use `device` with `{"action": "get_date_timestamp", "date": "today", "unit": "seconds"}`, then use `q=after:{TIMESTAMP} category:primary`
- "What emails did I receive in the last 24 hours?" -> `q=newer_than:1d category:primary`
- "Emails from this week" -> `q=newer_than:7d category:primary`
- "Emails from yesterday" -> Use `device` with `{"action": "get_date_timestamp", "date": "yesterday", "unit": "seconds"}`, then use `q=after:{TIMESTAMP} category:primary`

**Note:** Date formats like `after:YYYY/MM/DD` use PST timezone and may miss emails in other timezones. Always use Unix timestamps for accurate filtering.

### Send email

Use the `gmail_send` tool (only available when Gmail is enabled and configured).

The `gmail_send` tool handles all email formatting and encoding automatically. Simply provide the email parameters:

```json
{
  "to": "recipient@example.com",
  "subject": "Subject here",
  "body": "Message body here",
  "cc": "cc@example.com",
  "bcc": "bcc@example.com"
}
```

For replies, include thread information:

```json
{
  "to": "sender@example.com",
  "subject": "Re: Original subject",
  "body": "Reply text here",
  "threadId": "{THREAD_ID_OF_ORIGINAL_EMAIL}",
  "inReplyTo": "<message-id@mail.gmail.com>",
  "references": "<message-id@mail.gmail.com>"
}
```

### Reply to an email

Use the `gmail_send` tool.

When replying to an email using `gmail_send`:
1. `to` = **sender of the original email** (= value of the `From:` header of the received email). NOT the recipient.
2. `subject` = `Re: {ORIGINAL_SUBJECT}` (only prepend if not already starting with "Re:").
3. Set `inReplyTo` and `references` to the Message-ID from the original email (including angle brackets, e.g. `<abc123@mail.gmail.com>`).
4. Include `threadId` from the original email.

Example:

```json
{
  "to": "sender@example.com",
  "subject": "Re: Original subject",
  "body": "Reply text here.",
  "threadId": "{THREAD_ID_OF_ORIGINAL_EMAIL}",
  "inReplyTo": "<message-id@mail.gmail.com>",
  "references": "<message-id@mail.gmail.com>"
}
```

Find the `Message-ID` (for `inReplyTo`/`references`) and `threadId` in the email details fetch (`format=full`) under `payload.headers` and `threadId` respectively.

## Behavior rules for reading emails

### Never expose internal errors or API details

If an API call fails or returns unexpected results, **never** tell the user about label names, API errors, HTTP status codes, or internal implementation details. Simply retry silently with a fallback strategy, or say something generic like "Let me check that again" before retrying.

### Default: always summarize - never read verbatim

When the user asks to read, check, or show emails the content **MUST be summarized** in your own words - short, concise and in the language the user speaks.
Only when the user **explicitly** requests a literal/word-for-word reading (e.g. "read it verbatim", "read the exact text", "read it word for word") should you output the full original email body.

### Default: only primary/personal emails - ignore promotions/social/etc.

When the user asks for their emails, new messages, or inbox updates, **only fetch primary/personal emails** (use `q=category:primary`). Promotions, social notifications, updates, and forums are excluded by default.

Only fetch from other categories when the user explicitly asks for them (e.g. "Do I have any promotions?", "Check my spam", "Show me social emails").

If the user asks for "all emails" or "everything", fetch from `INBOX` (all categories) but clearly separate primary emails from the rest in the response: present primary emails first, then mention how many promotional/social/other emails there are without reading them in detail.

### Always announce attachments

When presenting an email, always state how many attachments it has.
- 0 attachments: do not mention attachments at all
- 1 attachment: "The email has one attachment."
- n attachments: "The email has n attachments."

Detect attachments by checking `payload.parts` - any part whose `filename` field is non-empty counts as an attachment.

## Workflow: Recent-communication overview

When the user asks for a general inbox update (e.g. "What's new?", "Check my inbox", "Any new emails?"):

1. Fetch the recent message list using `q=category:primary` (IDs), e.g. last 10. If 0 results, fall back to `labelIds=INBOX`.
2. For each message fetch **metadata only** (`format=metadata`, with `metadataHeaders=From,Subject,Date`).
3. Present a **brief overview list** sorted by time, containing only:
   - **Sender name** (extract display name from the `From` header)
   - **Subject**
   - **Relative time** (e.g. "5 minutes ago", "half an hour ago", "1 hour ago")
   - Example: *"Georg wrote 10 minutes ago, subject 'Project plan'. Karl half an hour ago, subject 'Meeting tomorrow'. Helga one hour ago, subject 'Invoice'."*
4. Do **NOT** fetch or read the email body at this stage.
5. Do **NOT** include promotional, social, or other non-primary emails unless explicitly asked.

### Drill-down into a specific email

When the user then asks about a specific email from the overview (e.g. "What did Georg write?", "Tell me about Karl's email"):

1. Fetch the full email details for that message (`format=full`).
2. **Summarize** the content (do NOT read verbatim).
3. Announce the number of attachments.

Only if the user then **explicitly** asks for a verbatim/word-for-word reading, output the full original text.

## Workflow: Read emails aloud

1. Fetch message list (IDs) using `q=category:primary` (fall back to `labelIds=INBOX`).
2. For each email: fetch details (sender, subject, body).
3. **Summarize** the content and read the summary aloud with the `tts` tool.
4. Announce attachment count per email.

## Examples

- "What's new in my inbox?" -> Recent-communication overview from primary only (sender + subject + relative time, no body)
- "What did Georg write?" -> Fetch & **summarize** Georg's email, announce attachments
- "Read it to me word for word" -> Read the full original email text verbatim
- "Read my unread emails" -> Search `is:unread category:primary`, fetch details, **summarize** each + TTS
- "What emails did I receive today?" -> Use `device` with `{"action": "get_date_timestamp", "date": "today", "unit": "seconds"}`, then search `q=after:{TIMESTAMP} category:primary`, fetch details, **summarize** each
- "What emails did I receive in the last 24 hours?" -> Search `q=newer_than:1d category:primary`, fetch details, **summarize** each
- "Show me emails from this week" -> Search `q=newer_than:7d category:primary`, present overview
- "Do I have any promotions?" -> Fetch with `q=category:promotions`, present overview
- "Is there an email from the bank?" -> Search `from:bank`
- "Write an email to..." -> Look up contact first, then send

## Notes

- Maximum sensible number of emails in an overview: 10
- When summarizing, keep it to 2-3 sentences max
- Always ask for confirmation before sending
- Use `format=metadata` (with `metadataHeaders=From,Subject,Date`) for the overview to save bandwidth; use `format=full` only when the user drills down into a specific email
- Use `q=category:primary` for default inbox queries (works regardless of account label setup); fall back to `labelIds=INBOX` if no results
- **Date filtering:** For "today" queries, use `device` tool with `get_date_timestamp` action: `{"action": "get_date_timestamp", "date": "today", "unit": "seconds"}`. Returns Unix timestamp in local timezone. Use with `after:{TIMESTAMP}` or `before:{TIMESTAMP}`. Reference: [Gmail API filtering](https://developers.google.com/workspace/gmail/api/guides/filtering)

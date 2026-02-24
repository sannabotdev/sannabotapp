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
---
# Gmail Skill

Read and send emails via the Gmail API.

## Tool: http

All requests require `auth_provider: "google"`.

### Gmail categories (labels)

Gmail sorts emails into categories. The relevant label IDs are:
- `CATEGORY_PRIMARY` - Important, personal emails (the main inbox tab)
- `CATEGORY_SOCIAL` - Social network notifications
- `CATEGORY_PROMOTIONS` - Marketing, newsletters, deals
- `CATEGORY_UPDATES` - Automated notifications, confirmations, receipts
- `CATEGORY_FORUMS` - Mailing lists, discussion groups
- `IMPORTANT` - Emails Gmail considers important (can overlap with any category)

### Fetch recent primary emails (default)

By default, always fetch from the **primary** category only:

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=CATEGORY_PRIMARY",
  "auth_provider": "google"
}
```

### Fetch emails from other categories

Only when the user explicitly asks for promotions, social, updates, etc.:

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=CATEGORY_PROMOTIONS",
  "auth_provider": "google"
}
```

Replace `CATEGORY_PROMOTIONS` with the appropriate label ID from the list above.

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
- `after:2024/01/01` - After a date
- `category:primary` - Primary emails only
- `category:promotions` - Promotions only

### Send email

```json
{
  "method": "POST",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  "auth_provider": "google",
  "body": {
    "raw": "{BASE64_ENCODED_EMAIL}"
  }
}
```

**Warning: NEVER base64url-encode the `raw` field yourself!**
Use the `device` tool with `encode_base64url` - only this ensures correct UTF-8 encoding.

**Workflow to send an email (2 steps):**

**Step 1** - Pass the email text as plain text to `device` (each header on its own line, blank line before body):

```json
{
  "action": "encode_base64url",
  "text": "To: recipient@example.com\nSubject: Subject here\n\nMessage body here"
}
```

**Step 2** - Use the returned string as `raw`:

```json
{
  "method": "POST",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  "auth_provider": "google",
  "body": {
    "raw": "{RESULT_FROM_encode_base64url}"
  }
}
```

### Reply to an email

When replying to an email you MUST:
1. `To:` = **sender of the original email** (= value of the `From:` header of the received email). NOT the recipient.
2. Subject = `Re: {ORIGINAL_SUBJECT}` (only prepend if not already starting with "Re:").
3. Set thread headers: `In-Reply-To: {MESSAGE_ID}` and `References: {MESSAGE_ID}` (Message-ID from the header of the original email, including angle brackets, e.g. `<abc123@mail.gmail.com>`).
4. Include `threadId` in the JSON body.

**Step 1** - Encode reply text:

```json
{
  "action": "encode_base64url",
  "text": "To: sender@example.com\nSubject: Re: Original subject\nIn-Reply-To: <message-id@mail.gmail.com>\nReferences: <message-id@mail.gmail.com>\n\nReply text here."
}
```

**Step 2** - Send with `threadId`:

```json
{
  "method": "POST",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  "auth_provider": "google",
  "body": {
    "raw": "{RESULT_FROM_encode_base64url}",
    "threadId": "{THREAD_ID_OF_ORIGINAL_EMAIL}"
  }
}
```

Find the `Message-ID` (for `In-Reply-To`/`References`) and `threadId` in the email details fetch (`format=full`) under `payload.headers` and `threadId` respectively.

## Behavior rules for reading emails

### Default: always summarize - never read verbatim

When the user asks to read, check, or show emails the content **MUST be summarized** in your own words - short, concise and in the language the user speaks.
Only when the user **explicitly** requests a literal/word-for-word reading (e.g. "read it verbatim", "read the exact text", "read it word for word") should you output the full original email body.

### Default: only primary emails - ignore promotions/social/etc.

When the user asks for their emails, new messages, or inbox updates, **only fetch from `CATEGORY_PRIMARY`**. Promotions, social notifications, updates, and forums are excluded by default.

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

1. Fetch the recent message list from **`CATEGORY_PRIMARY` only** (IDs), e.g. last 10.
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

1. Fetch message list (IDs) from `CATEGORY_PRIMARY`.
2. For each email: fetch details (sender, subject, body).
3. **Summarize** the content and read the summary aloud with the `tts` tool.
4. Announce attachment count per email.

## Examples

- "What's new in my inbox?" -> Recent-communication overview from PRIMARY only (sender + subject + relative time, no body)
- "What did Georg write?" -> Fetch & **summarize** Georg's email, announce attachments
- "Read it to me word for word" -> Read the full original email text verbatim
- "Read my unread emails" -> Search `is:unread category:primary`, fetch details, **summarize** each + TTS
- "Do I have any promotions?" -> Fetch from `CATEGORY_PROMOTIONS`, present overview
- "Is there an email from the bank?" -> Search `from:bank`
- "Write an email to..." -> Look up contact first, then send

## Notes

- Maximum sensible number of emails in an overview: 10
- When summarizing, keep it to 2-3 sentences max
- Always ask for confirmation before sending
- Use `format=metadata` (with `metadataHeaders=From,Subject,Date`) for the overview to save bandwidth; use `format=full` only when the user drills down into a specific email
- Default to `CATEGORY_PRIMARY` for all inbox queries; only switch to other categories on explicit user request

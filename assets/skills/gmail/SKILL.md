---
name: gmail
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

### Fetch recent emails (inbox)

```json
{
  "method": "GET",
  "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX",
  "auth_provider": "google"
}
```

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
- `from:boss@company.com` – From a specific person
- `subject:Meeting` – Subject contains "Meeting"
- `is:unread` – Unread emails
- `after:2024/01/01` – After a date

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

**⚠️ IMPORTANT: NEVER base64url-encode the `raw` field yourself!**
Use the `device` tool with `encode_base64url` – only this ensures correct UTF-8 encoding.

**Workflow to send an email (2 steps):**

**Step 1** – Pass the email text as plain text to `device` (each header on its own line, blank line before body):

```json
{
  "action": "encode_base64url",
  "text": "To: recipient@example.com\nSubject: Subject here\n\nMessage body here"
}
```

**Step 2** – Use the returned string as `raw`:

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

**Step 1** – Encode reply text:

```json
{
  "action": "encode_base64url",
  "text": "To: sender@example.com\nSubject: Re: Original subject\nIn-Reply-To: <message-id@mail.gmail.com>\nReferences: <message-id@mail.gmail.com>\n\nReply text here."
}
```

**Step 2** – Send with `threadId`:

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

## Workflow: Read emails aloud

1. Fetch message list (IDs)
2. For each email: fetch details (sender, subject, snippet)
3. Read aloud with `tts` tool

## Examples

- "Read my unread emails" → Search `is:unread`, fetch details + TTS
- "Is there an email from the bank?" → Search `from:bank`
- "Write an email to..." → Look up contact first, then send

## Notes

- Maximum sensible number of emails to read aloud: 5
- Long emails: only read snippet/beginning
- Always ask for confirmation before sending

---
name: sms
category: communication
description: Send SMS directly and open the messaging app
permissions:
 - android.permission.SEND_SMS
 - android.permission.READ_CONTACTS
---
# SMS / Messages

Send SMS directly or open the messaging app.

## Tool: send_sms (PREFERRED)

Sends SMS directly in the background – the user does NOT need to tap "Send" in the SMS app.

```json
{
  "phone_number": "+4366012345678",
  "message": "I'll be 10 minutes late"
}
```

### Important for send_sms
- **Always ask for confirmation** before sending the SMS: "Shall I send an SMS to +43... with the text '...'?"
- Only call the send_sms tool after the user confirms!
- The SMS is sent immediately and cannot be undone.

## Tool: intent (Alternative – opens SMS app)

If the user wants to review or edit the SMS before sending, use the intent:

### Open SMS app (with pre-filled recipient and message)

```json
{
  "action": "android.intent.action.SENDTO",
  "uri": "smsto:{NUMBER}",
  "extras": {
    "sms_body": "{MESSAGE_TEXT}"
  }
}
```

### Open SMS app only

```json
{
  "action": "android.intent.action.MAIN",
  "package": "com.android.mms"
}
```

## Number format

- `+4366012345678` (international format preferred)
- `06601234567` (local format)

## Workflow

1. User says "Text Markus: I'll be there later"
2. Look up contact with `query` tool (contacts)
3. Extract phone number
4. Ask for confirmation: "Shall I send to Markus (+4366012345678): 'I'll be there later'?"
5. After confirmation: call `send_sms` tool

## Examples

- "Text Markus: I'll be 10 minutes late" → Look up contact → Confirmation → send_sms
- "SMS to +43660... with text xyz" → Confirmation → send_sms
- "Open the messaging app" → MAIN intent for SMS app
- "I want to review the SMS first" → SENDTO intent (opens SMS app)

## WhatsApp Alternative

For WhatsApp messages:
```json
{
  "action": "android.intent.action.VIEW",
  "uri": "https://wa.me/{NUMBER}?text={TEXT}",
  "package": "com.whatsapp"
}
```

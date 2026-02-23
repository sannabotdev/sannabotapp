---
name: whatsapp
description: Send WhatsApp messages and open WhatsApp
test_prompt: Open WhatsApp
android_package: com.whatsapp
permissions:
 - android.permission.READ_CONTACTS
---
# WhatsApp Skill

Send WhatsApp messages and open WhatsApp chats via Android intents.

## Tool: intent

### Send a message to a number (opens WhatsApp with pre-filled text)

```json
{
  "action": "android.intent.action.VIEW",
  "uri": "https://wa.me/{NUMBER_WITHOUT_PLUS}?text={URL_ENCODED_TEXT}",
  "package": "com.whatsapp"
}
```

**Important**: The number must be in international format WITHOUT `+` and WITHOUT spaces.
- `+43 660 1234567` → `436601234567`
- `+49 151 12345678` → `4915112345678`
- `0660 1234567` (Austria) → `436601234567` (replace leading 0 with country code 43)

**Important**: The text in the URI must be URL-encoded (spaces = `%20`, special characters etc.).

### Open chat with contact (without pre-filled text)

```json
{
  "action": "android.intent.action.VIEW",
  "uri": "https://wa.me/{NUMBER_WITHOUT_PLUS}",
  "package": "com.whatsapp"
}
```

### Open WhatsApp app

```json
{
  "action": "android.intent.action.MAIN",
  "package": "com.whatsapp"
}
```

### Send message via SENDTO intent (alternative)

```json
{
  "action": "android.intent.action.SENDTO",
  "uri": "smsto:{NUMBER}",
  "package": "com.whatsapp",
  "extras": {
    "sms_body": "{MESSAGE_TEXT}"
  }
}
```

## Number format for wa.me links

| Input | wa.me number |
|---|---|
| +43 660 1234567 | 436601234567 |
| 0660 1234567 (AT) | 436601234567 |
| +49 151 12345678 | 4915112345678 |
| 0151 12345678 (DE) | 4915112345678 |

**Rules**:
1. Remove `+` sign
2. Remove all spaces and hyphens
3. If the number starts with `0` (local format), replace the `0` with the country code (Austria: `43`, Germany: `49`)

## Workflow: Send a message

1. User says "Text Stefan on WhatsApp: I'll be there in 5 minutes"
2. Look up contact with `query` tool (contacts): `{"type": "contacts", "query": "Stefan"}`
3. Extract phone number from result
4. Convert number to wa.me format (without +, without spaces)
5. URL-encode the text
6. Ask for confirmation: "Shall I write to Stefan on WhatsApp: 'I'll be there in 5 minutes'?"
7. After confirmation: call `intent` tool with wa.me link

## Workflow: Open a chat

1. User says "Open the WhatsApp chat with Mom"
2. Look up contact with `query` tool
3. Convert number
4. Execute intent with wa.me link (without text)

## Examples

- "Text Markus on WhatsApp: I'll be there later" → Look up contact → Confirmation → intent VIEW wa.me
- "WhatsApp message to +43 660 1234567: Meeting at 3 PM" → Confirmation → intent VIEW wa.me
- "Open the WhatsApp chat with Lisa" → Look up contact → intent VIEW wa.me (without text)
- "Open WhatsApp" → intent MAIN com.whatsapp
- "Send a WhatsApp to Stefan that the meeting is moved" → Look up contact → Confirmation → intent VIEW wa.me

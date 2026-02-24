---
name: whatsapp
description: Send WhatsApp messages and open WhatsApp chats – including fully automated sending via Accessibility
test_prompt: Open WhatsApp
android_package: com.whatsapp
permissions:
 - android.permission.READ_CONTACTS
---
# WhatsApp Skill

Send WhatsApp messages and open WhatsApp chats via Android intents or fully automated via Accessibility.

## Tool: accessibility (PREFERRED for sending messages)

Use this tool when the user wants to **send** a WhatsApp message without manually tapping Send.
The LLM sub-agent opens WhatsApp, reads the UI, types the message and presses the Send button automatically.

**Requires**: Accessibility Service enabled (Settings → Accessibility → Sanna).

### Send a message to a phone number

```json
{
  "package_name": "com.whatsapp",
  "goal": "Type '<MESSAGE>' in the message input field and tap the Send button.",
  "intent_action": "android.intent.action.VIEW",
  "intent_uri": "https://wa.me/<NUMBER_WITHOUT_PLUS>"
}
```

**Example**: Send "I'll be there in 5 minutes" to +43 660 1234567

```json
{
  "package_name": "com.whatsapp",
  "goal": "Type 'I\\'ll be there in 5 minutes' in the message input field and tap the Send button.",
  "intent_action": "android.intent.action.VIEW",
  "intent_uri": "https://wa.me/436601234567"
}
```

**Important**: The number in the URI must be in international format WITHOUT `+` and WITHOUT spaces.
- `+43 660 1234567` → `436601234567`
- `+49 151 12345678` → `4915112345678`
- `0660 1234567` (Austria) → `436601234567` (replace leading 0 with country code 43)

---

## Tool: intent (Alternative – opens WhatsApp with pre-filled text, user must tap Send)

### Open WhatsApp chat with pre-filled message

```json
{
  "action": "android.intent.action.VIEW",
  "uri": "https://wa.me/{NUMBER_WITHOUT_PLUS}?text={URL_ENCODED_TEXT}",
  "package": "com.whatsapp"
}
```

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

---

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

---

## Workflow: Send a message (fully automated)

1. User says "Text Stefan on WhatsApp: I'll be there in 5 minutes"
2. Look up contact with `query` tool: `{"type": "contacts", "query": "Stefan"}`
3. Extract phone number and convert to wa.me format
4. Ask for confirmation: "Shall I send Stefan a WhatsApp: 'I'll be there in 5 minutes'?"
5. After confirmation: call `accessibility` tool with wa.me intent + goal

## Workflow: Send a message (opens WhatsApp, user taps Send)

1. User says "Text Stefan on WhatsApp: I'll be there in 5 minutes"
2. Look up contact with `query` tool (contacts): `{"type": "contacts", "query": "Stefan"}`
3. Extract phone number from result
4. Convert number to wa.me format (without +, without spaces)
5. URL-encode the text
6. Ask for confirmation: "Shall I write to Stefan on WhatsApp: 'I'll be there in 5 minutes'?"
7. After confirmation: call `intent` tool with wa.me link + `?text=` parameter

## Workflow: Open a chat

1. User says "Open the WhatsApp chat with Mom"
2. Look up contact with `query` tool
3. Convert number
4. Execute intent with wa.me link (without text)

---

## Examples

- "Text Markus on WhatsApp: I'll be there later" → Look up contact → Confirmation → **accessibility** (fully automated send)
- "WhatsApp message to +43 660 1234567: Meeting at 3 PM" → Confirmation → **accessibility** (fully automated send)
- "Open the WhatsApp chat with Lisa" → Look up contact → intent VIEW wa.me (without text)
- "Open WhatsApp" → intent MAIN com.whatsapp
- "Send a WhatsApp to Stefan that the meeting is moved" → Look up contact → Confirmation → **accessibility** (fully automated send)

---
name: contacts
category: information
description: Search contacts and retrieve contact information
test_prompt: Search for contacts and show the first 3
permissions:
 - android.permission.READ_CONTACTS
---
# Contacts Skill

Search and manage contacts on the device.

## Tool: query

### Search contact by name

```json
{
  "type": "contacts",
  "query": "{NAME}",
  "limit": 5
}
```

### Retrieve all contacts (max 20)

```json
{
  "type": "contacts",
  "limit": 20
}
```

## Workflow: Call someone

1. Search contact with `query`
2. Extract phone number from result
3. Call using `intent` (phone skill)

## Workflow: Send SMS

1. Search contact with `query`
2. Extract phone number
3. Open SMS app using `intent` (sms skill)

## Examples

- "Call Mom" → query contacts "Mom" → number → intent CALL
- "Text Stefan" → query contacts "Stefan" → number → intent SENDTO
- "What is Lisa's number?" → query contacts "Lisa" → TTS read out number

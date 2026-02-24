---
name: phone
category: communication
description: Make phone calls and control phone functions
permissions:
 - android.permission.CALL_PHONE
 - android.permission.READ_CONTACTS
---
# Phone / Calls

Make calls and use phone functions.

## Tool: intent

### Start a call (immediately)

```json
{
  "action": "android.intent.action.CALL",
  "uri": "tel:{NUMBER}"
}
```

### Open phone app (with pre-filled number)

```json
{
  "action": "android.intent.action.DIAL",
  "uri": "tel:{NUMBER}"
}
```

The difference: `CALL` starts the call immediately, `DIAL` opens the dialer with the number pre-filled.

### Number format

- Austria: `+43660...` or `0660...`
- Germany: `+4915...`
- International format: `+{country_code}{number_without_leading_0}`

## Contacts

If the user mentions a name (e.g. "Call Mom"), use the `query` tool to look up the phone number before calling.

## Examples

- "Call 0660 1234567" → `tel:06601234567`
- "Dial +43 1 234 5678" → `tel:+4312345678`
- "Open the dialer with 112" → DIAL action with `tel:112`
- "Emergency numbers: Ambulance 144, Police 133, Fire 122"

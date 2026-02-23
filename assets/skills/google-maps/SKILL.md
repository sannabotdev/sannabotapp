---
name: google-maps
description: Navigation and route planning via the Google Maps app
android_package: com.google.android.apps.maps
permissions:
 - android.permission.ACCESS_FINE_LOCATION
---
# Google Maps Navigation

Start navigation and show locations using the Google Maps app.

## Tool: intent

Use the `intent` tool to open Google Maps.

### Start navigation

```json
{
  "action": "android.intent.action.VIEW",
  "uri": "google.navigation:q={DESTINATION}",
  "package": "com.google.android.apps.maps"
}
```

Examples for the URI field:
- `google.navigation:q=Vienna+Central+Station` → navigates to Vienna Central Station
- `google.navigation:q=48.2082,16.3738` → navigates to GPS coordinates
- `google.navigation:q=Graz&mode=d` → navigates to Graz (driving mode)
- `google.navigation:q=Linz&mode=w` → navigates to Linz (walking mode)
- `google.navigation:q=Salzburg&mode=b` → navigates to Salzburg (cycling mode)

### Show location (without navigation)

```json
{
  "action": "android.intent.action.VIEW",
  "uri": "geo:0,0?q={SEARCH_TERM}",
  "package": "com.google.android.apps.maps"
}
```

### Traffic information

```json
{
  "action": "android.intent.action.VIEW",
  "uri": "google.navigation:q={DESTINATION}&traffic=true",
  "package": "com.google.android.apps.maps"
}
```

## Examples

- "Navigate to the train station" → `google.navigation:q=Vienna+Central+Station`
- "Drive to Graz" → `google.navigation:q=Graz`
- "Show me where the park is" → `geo:0,0?q=Prater+Vienna`
- "Navigate home" → `google.navigation:q=home`
- "How do I get to Salzburg?" → `google.navigation:q=Salzburg`
- "Gas station nearby" → `geo:0,0?q=gas+station`

## Notes

- Replace spaces in destination with `+`
- For addresses use: "Street+Number+City"
- Umlauts can be used directly or URL-encoded: ä=%C3%A4, ö=%C3%B6, ü=%C3%BC

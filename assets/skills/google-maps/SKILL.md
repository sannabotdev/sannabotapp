---
name: google-maps
category: information
description: Navigation and route planning via the Google Maps app
android_package: com.google.android.apps.maps
permissions:
 - android.permission.ACCESS_FINE_LOCATION
credentials:
 - id: google_maps_api_key
   label: Google Maps API Key
   type: api_key
---
# Google Maps Navigation

Start navigation, look up addresses, and query route/traffic information.

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

### Stop navigation

To stop an active navigation session, use the `accessibility` tool to find and tap the "Stop" or "Exit" button inside the running Google Maps app:

1. Bring Google Maps to the foreground (intent with `android.intent.action.MAIN`).
2. Call `get_accessibility_tree` on `com.google.android.apps.maps` to locate the stop/exit button node.
3. Call `accessibility_action` with action `"click"` on that node.

---

## Tool: http – Route & Traffic Information (requires API key)

**Before calling the Routes API, always check whether the API key is configured:**

```
check_credential("google_maps_api_key")
```

If `configured: false` → inform the user that they need to add the Google Maps API key under Settings → Services and skip the API call.

If `configured: true` → proceed. Use `auth_provider: "google_maps_api_key"` and `auth_header: "X-Goog-Api-Key"` in the `http` call. The tool injects the key into that header automatically.

### Get route + travel time + traffic information (Google Maps Routes API)

> ⚠️ **`X-Goog-FieldMask` is a REQUIRED header – always include it. The API returns 400 without it.**

The Routes API accepts **plain address strings** directly in `origin` and `destination` – no separate geocoding step needed. Use `"address"` for named places, `"latLng"` only when you already have GPS coordinates.

```json
{
  "method": "POST",
  "url": "https://routes.googleapis.com/directions/v2:computeRoutes",
  "auth_provider": "google_maps_api_key",
  "auth_header": "X-Goog-Api-Key",
  "headers": [
    { "key": "X-Goog-FieldMask", "value": "routes.duration,routes.distanceMeters,routes.staticDuration,routes.legs.travelAdvisory.speedReadingIntervals" }
  ],
  "body": {
    "origin": {
      "address": "Current location or street address"
    },
    "destination": {
      "address": "City or street address"
    },
    "travelMode": "DRIVE",
    "routingPreference": "TRAFFIC_AWARE"
  }
}
```

For the origin, prefer `"latLng"` with coordinates from `device get_location` for accuracy. For the destination, always use `"address"` with the place name – no geocoding API needed.

**Response fields:**
- `duration` (seconds string, e.g. `"3600s"`) – travel time with live traffic → convert to h/min
- `staticDuration` – travel time without traffic → compare to `duration` for delay
- `distanceMeters` → convert to km
- `legs[].travelAdvisory.speedReadingIntervals[].speed`: `NORMAL` / `SLOW` / `TRAFFIC_JAM`

**How to present the result – always natural language, no raw data:**
- Convert seconds to "X Std. Y Min." (or "X h Y min" in English)
- Convert meters to km (round to nearest km)
- Never show GPS coordinates, field names, raw seconds, or JSON to the user
- If `duration` < `staticDuration`: traffic is lighter than usual → mention it
- If `duration` > `staticDuration` by more than 5 min: there is a delay → state how many minutes
- If `TRAFFIC_JAM` segments exist: mention congestion on the route
- Good: "Nach Graz sind es ca. 194 km, Fahrzeit etwa 2 Std. 14 Min. – aktuell kein Stau."
- Bad: "duration: 8061s, staticDuration: 8475s, koordinaten: 48.076700, 16.014198"

**Full workflow – "Is there traffic on the way to Vienna?":**
1. `check_credential("google_maps_api_key")` – if not configured, tell the user and stop
2. `device` `get_location` to get current GPS coordinates (use as `origin.latLng`)
3. `http` POST Routes API with destination as `"address": "Vienna"` → extract `duration`, `staticDuration`, `distanceMeters`, `speedReadingIntervals`
4. Count `TRAFFIC_JAM` segments; compare `duration` vs `staticDuration` to estimate delay
5. Respond in plain natural language – distance in km, time in h/min, traffic in words

---

## Examples

- "Navigate to the train station" → `google.navigation:q=Vienna+Central+Station`
- "Drive to Graz" → `google.navigation:q=Graz`
- "Show me where the park is" → `geo:0,0?q=Prater+Vienna`
- "Navigate home" → `google.navigation:q=home`
- "Stop navigation" → accessibility tool to tap stop button
- "How long to Vienna?" → check_credential → get_location → Routes API (destination as address string) → tts
- "Is there a traffic jam on the way to Graz?" → check_credential → get_location → Routes API → check speedReadingIntervals → tts
- "Gas station nearby" → `geo:0,0?q=gas+station`

## Notes

- Replace spaces in destination with `+`
- For addresses use: "Street+Number+City"
- Umlauts can be used directly or URL-encoded: ä=%C3%A4, ö=%C3%B6, ü=%C3%BC
- Routes API requires the Google Maps API key in Settings → Services
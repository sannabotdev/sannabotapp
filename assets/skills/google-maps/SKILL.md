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

### Get route + travel time (Google Maps Routes API)

```json
{
  "method": "POST",
  "url": "https://routes.googleapis.com/directions/v2:computeRoutes",
  "auth_provider": "google_maps_api_key",
  "auth_header": "X-Goog-Api-Key",
  "headers": {
    "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.travelAdvisory,routes.legs.travelAdvisory.speedReadingIntervals"
  },
  "body": {
    "origin": {
      "location": { "latLng": { "latitude": 0, "longitude": 0 } }
    },
    "destination": {
      "location": { "latLng": { "latitude": 0, "longitude": 0 } }
    },
    "travelMode": "DRIVE",
    "routingPreference": "TRAFFIC_AWARE"
  }
}
```

Replace the placeholder coordinates with real values from address lookup / device location.

**Response fields:**
- `duration` (e.g. `"3600s"`) – total travel time including live traffic; convert to minutes/hours
- `distanceMeters` – total distance; convert to km
- `legs[].travelAdvisory.speedReadingIntervals[]` – list of route segments with a `speed` field:
  - `NORMAL` – free flow
  - `SLOW` – slowed traffic
  - `TRAFFIC_JAM` – standstill / congestion

Count or locate `TRAFFIC_JAM` / `SLOW` entries to report whether there are traffic jams on the route. If any `TRAFFIC_JAM` segments exist, tell the user there is congestion and roughly where (first vs. last part of the route).

**Full workflow – "Is there traffic on the way to Vienna?":**
1. `check_credential("google_maps_api_key")` – if not configured, tell the user and stop
2. `device` `get_location` to get current coordinates
3. Use the Google Maps Geocoding API (same `auth_provider`) to resolve the destination → `lat`, `lon`
4. `http` POST Routes API → extract `duration`, `distanceMeters`, `speedReadingIntervals`
5. Count `TRAFFIC_JAM` segments; compare `duration` against `staticDuration` if available to estimate delay
6. `tts` e.g. "The route to Vienna is 180 km. Travel time is 2 hours 10 minutes – there are traffic jams on the route." or "No significant traffic, estimated 1 hour 45 minutes."

---

## Examples

- "Navigate to the train station" → `google.navigation:q=Vienna+Central+Station`
- "Drive to Graz" → `google.navigation:q=Graz`
- "Show me where the park is" → `geo:0,0?q=Prater+Vienna`
- "Navigate home" → `google.navigation:q=home`
- "Stop navigation" → accessibility tool to tap stop button
- "How long to Vienna?" → check_credential → Geocoding API → Routes API → tts
- "Is there a traffic jam on the way to Graz?" → check_credential → Geocoding API → Routes API → check speedReadingIntervals → tts
- "Gas station nearby" → `geo:0,0?q=gas+station`

## Notes

- Replace spaces in destination with `+`
- For addresses use: "Street+Number+City"
- Umlauts can be used directly or URL-encoded: ä=%C3%A4, ö=%C3%B6, ü=%C3%BC
- Routes API requires the Google Maps API key in Settings → Services

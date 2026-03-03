---
name: google-maps
category: information
description: Start navigation, get directions and route info via Google Maps app. Tools: intent, http (optional, requires Maps API key for traffic/route details).
android_package: com.google.android.apps.maps
permissions:
 - android.permission.ACCESS_FINE_LOCATION
credentials:
 - id: google_maps_api_key
   label: Google Maps API Key
   type: api_key
---
# Google Maps Navigation

Start navigation, look up addresses, calculate distances, and query route/traffic information.

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
- `google.navigation:q=Grand+Central+Station` → navigates to Grand Central Station
- `google.navigation:q=51.5074,-0.1278` → navigates to GPS coordinates
- `google.navigation:q=Paris&mode=d` → navigates to Paris (driving mode)
- `google.navigation:q=New+York&mode=w` → navigates to New York (walking mode)
- `google.navigation:q=Los+Angeles&mode=b` → navigates to Los Angeles (cycling mode)

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
- Convert seconds to "X h Y min" (or "X hours Y minutes" in English)
- Convert meters to km (round to nearest km)
- Never show GPS coordinates, field names, raw seconds, or JSON to the user
- If `duration` < `staticDuration`: traffic is lighter than usual → mention it
- If `duration` > `staticDuration` by more than 5 min: there is a delay → state how many minutes
- If `TRAFFIC_JAM` segments exist: mention congestion on the route
- Good: "To Paris it's about 350 km, travel time approximately 3 h 45 min – currently no traffic."
- Bad: "duration: 13500s, staticDuration: 14000s, coordinates: 48.8566, 2.3522"

**Full workflow – "Is there traffic on the way to London?":**
1. `check_credential("google_maps_api_key")` – if not configured, tell the user and stop
2. `device` `get_location` to get current GPS coordinates (use as `origin.latLng`)
3. `http` POST Routes API with destination as `"address": "London"` → extract `duration`, `staticDuration`, `distanceMeters`, `speedReadingIntervals`
4. Count `TRAFFIC_JAM` segments; compare `duration` vs `staticDuration` to estimate delay
5. Respond in plain natural language – distance in km, time in h/min, traffic in words

### Calculate distance between two locations

**IMPORTANT: Choose the right method based on your needs:**

1. **Straight-line distance (as the crow flies) between two GPS coordinates** → Use Haversine formula (no API key needed, see below)
2. **Driving/walking distance (route distance)** → Use Routes API (requires API key, see below)

#### Straight-line distance between two GPS coordinates (Haversine formula)

For calculating the straight-line distance between two GPS coordinates (e.g., checking if you're within X km of a location), use the `device` tool with action `calculate_distance`. This requires **no API key**.

**Using the device tool:**
```json
{
  "action": "calculate_distance",
  "latitude1": 48.1234,
  "longitude1": 16.5678,
  "latitude2": 48.0600,
  "longitude2": 16.0840
}
```

Returns distance in kilometers (e.g., "Distance: 5.23 km (5230 m)").

**Workflow for "check if within X km of location":**
1. Get current location: `device` `get_location` → returns coordinates (e.g., `48.1234, 16.5678`)
2. Calculate distance: `device` `calculate_distance` with:
   - `latitude1`, `longitude1`: current location from step 1
   - `latitude2`, `longitude2`: target location coordinates
3. Extract distance from result (in km) and compare to threshold (e.g., `if (distance < 5) { /* within 5 km */ }`)

#### Route distance (driving/walking distance) via Routes API

To calculate the **driving, walking, or cycling distance** between two locations (addresses or coordinates), use the Routes API with the `distanceMeters` field in the field mask. **This requires a Google Maps API key.**

**Distance between two addresses:**
```json
{
  "method": "POST",
  "url": "https://routes.googleapis.com/directions/v2:computeRoutes",
  "auth_provider": "google_maps_api_key",
  "auth_header": "X-Goog-Api-Key",
  "headers": [
    { "key": "X-Goog-FieldMask", "value": "routes.distanceMeters" }
  ],
  "body": {
    "origin": {
      "address": "Berlin, Germany"
    },
    "destination": {
      "address": "Munich, Germany"
    },
    "travelMode": "DRIVE"
  }
}
```

**Distance from current location to an address:**
1. Get current location: `device` `get_location` → returns `{ latitude, longitude }`
2. Use Routes API with `origin.latLng`:
```json
{
  "method": "POST",
  "url": "https://routes.googleapis.com/directions/v2:computeRoutes",
  "auth_provider": "google_maps_api_key",
  "auth_header": "X-Goog-Api-Key",
  "headers": [
    { "key": "X-Goog-FieldMask", "value": "routes.distanceMeters" }
  ],
  "body": {
    "origin": {
      "latLng": {
        "latitude": 52.5200,
        "longitude": 13.4050
      }
    },
    "destination": {
      "address": "Paris, France"
    },
    "travelMode": "DRIVE"
  }
}
```

**Distance between two coordinates:**
```json
{
  "method": "POST",
  "url": "https://routes.googleapis.com/directions/v2:computeRoutes",
  "auth_provider": "google_maps_api_key",
  "auth_header": "X-Goog-Api-Key",
  "headers": [
    { "key": "X-Goog-FieldMask", "value": "routes.distanceMeters" }
  ],
  "body": {
    "origin": {
      "latLng": {
        "latitude": 52.5200,
        "longitude": 13.4050
      }
    },
    "destination": {
      "latLng": {
        "latitude": 48.8566,
        "longitude": 2.3522
      }
    },
    "travelMode": "DRIVE"
  }
}
```

**Response handling:**
- Extract `routes[0].distanceMeters` from the response
- Convert meters to kilometers: `distanceKm = distanceMeters / 1000`
- Round to 1 decimal place for display
- Present in natural language: "The distance is approximately 350 km" or "It's about 2.5 km away"

**Travel modes for distance calculation:**
- `DRIVE` – driving distance (default, most common)
- `WALK` – walking distance
- `BICYCLE` – cycling distance
- `TRANSIT` – public transit distance

**Full workflow – "How far is Paris from here?" (route distance):**
1. `check_credential("google_maps_api_key")` – if not configured, tell the user and stop
2. `device` `get_location` to get current GPS coordinates
3. `http` POST Routes API with `origin.latLng` (current location) and `destination.address` ("Paris")
4. Extract `routes[0].distanceMeters` from response
5. Convert to km and respond: "Paris is approximately 350 km away from your current location"

**Full workflow – "Am I within 5 km of a location?" (straight-line distance):**
1. `device` `get_location` to get current GPS coordinates (e.g., `lat1 = 48.1234, lon1 = 16.5678`)
2. `device` `calculate_distance` with current location and target coordinates (e.g., `lat2 = 48.0600, lon2 = 16.0840`)
3. Extract distance from result (in km) and compare: `if (distance < 5) { /* within 5 km */ }`
4. No API key needed for this calculation

---

## Examples

- "Navigate to the train station" → `google.navigation:q=Grand+Central+Station`
- "Drive to Paris" → `google.navigation:q=Paris`
- "Show me where the park is" → `geo:0,0?q=Central+Park+New+York`
- "Navigate home" → `google.navigation:q=home`
- "Stop navigation" → accessibility tool to tap stop button
- "How long to London?" → check_credential → get_location → Routes API (destination as address string) → tts
- "Is there a traffic jam on the way to Paris?" → check_credential → get_location → Routes API → check speedReadingIntervals → tts
- "Gas station nearby" → `geo:0,0?q=gas+station`
- "How far is Berlin from Munich?" (route distance) → check_credential → Routes API (origin: "Berlin", destination: "Munich") → extract distanceMeters → convert to km → tts
- "What's the distance to Paris?" (route distance) → check_credential → get_location → Routes API (origin: current location, destination: "Paris") → extract distanceMeters → convert to km → tts
- "Calculate distance between these two addresses" (route distance) → check_credential → Routes API with both addresses → extract distanceMeters → tts
- "Am I within 5 km of a location?" (straight-line distance) → get_location → calculate_distance with target coordinates → compare to 5 km → tts
- "Check if I'm near location X" (straight-line distance) → get_location → calculate_distance → compare to threshold → tts

## Notes

- Replace spaces in destination with `+`
- For addresses use: "Street+Number+City"
- Umlauts can be used directly or URL-encoded: ä=%C3%A4, ö=%C3%B6, ü=%C3%BC
- Routes API requires the Google Maps API key in Settings → Services
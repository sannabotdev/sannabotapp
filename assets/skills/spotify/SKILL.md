---
name: spotify
category: media
description: Play, pause, skip, search and control Spotify playback. Requires Spotify OAuth. Tools: http, intent, accessibility (only for NO_ACTIVE_DEVICE recovery).
test_prompt: Fetch the currently playing track or show the user profile
android_package: com.spotify.music
permissions:
 - android.permission.INTERNET
credentials:
 - id: spotify_credentials
   label: Spotify Login
   type: oauth
   auth_provider: spotify
---
# Spotify Skill

Control Spotify playback via the Web API and app intents.

## Tool: http (Spotify Web API)

All requests require `auth_provider: "spotify"`.

Base URL: `https://api.spotify.com/v1`

### Get currently playing track

```json
{
  "method": "GET",
  "url": "https://api.spotify.com/v1/me/player/currently-playing",
  "auth_provider": "spotify"
}
```

### Start/resume playback

```json
{
  "method": "PUT",
  "url": "https://api.spotify.com/v1/me/player/play",
  "auth_provider": "spotify"
}
```

### Pause playback

```json
{
  "method": "PUT",
  "url": "https://api.spotify.com/v1/me/player/pause",
  "auth_provider": "spotify"
}
```

### Next track

```json
{
  "method": "POST",
  "url": "https://api.spotify.com/v1/me/player/next",
  "auth_provider": "spotify"
}
```

### Previous track

```json
{
  "method": "POST",
  "url": "https://api.spotify.com/v1/me/player/previous",
  "auth_provider": "spotify"
}
```

### Search for music

```json
{
  "method": "GET",
  "url": "https://api.spotify.com/v1/search?q={SEARCH_TERM}&type=track,artist,playlist&limit=5",
  "auth_provider": "spotify"
}
```

### Play track/artist/playlist (after search)

```json
{
  "method": "PUT",
  "url": "https://api.spotify.com/v1/me/player/play",
  "auth_provider": "spotify",
  "body": {
    "context_uri": "spotify:artist:{ARTIST_ID}"
  }
}
```

Or for individual tracks:
```json
{
  "body": {
    "uris": ["spotify:track:{TRACK_ID}"]
  }
}
```

### Set volume (0-100)

```json
{
  "method": "PUT",
  "url": "https://api.spotify.com/v1/me/player/volume?volume_percent={0-100}",
  "auth_provider": "spotify"
}
```

## Tool: intent (open Spotify app directly)

```json
{
  "action": "android.intent.action.VIEW",
  "uri": "spotify:track:{TRACK_ID}",
  "package": "com.spotify.music"
}
```

## Tool: accessibility (ONLY for NO_ACTIVE_DEVICE errors)

**IMPORTANT**: Use accessibility ONLY when the Web API returns a `NO_ACTIVE_DEVICE` error (HTTP 404 with `"reason": "NO_ACTIVE_DEVICE"`). All other actions (pause, next, previous, volume, search, play specific tracks) MUST be done via the Web API.

### When to use: NO_ACTIVE_DEVICE

If any playback API call returns `HTTP 404 / NO_ACTIVE_DEVICE`, Spotify has no active player on any device. Fix this by opening Spotify and selecting this phone as the active device:

```json
{
  "package_name": "com.spotify.music",
  "goal": "Open Spotify. In the mini-player bar at the bottom of the screen, tap the devices/connect icon (the monitor icon to the left of the + button). A bottom sheet titled 'Connect' will appear. In that sheet, tap the first row that shows a smartphone icon – it represents this phone (labeled 'Dieses Smartphone' in German or 'This phone' / 'This device' in English). Tap it to activate playback on this device."
}
```

After the accessibility tool completes, **immediately retry** the original API play call (with the same URI/body as before).

**Note**: Once this phone is selected as the active device, all further control (pause, next, previous, volume) should be done via the Web API, NOT via accessibility.

## Workflow: Play music

1. Search for artist/song using `http`
2. Get context URI or track URI from search results
3. Call play endpoint with the URI
   - If response is `HTTP 404 / NO_ACTIVE_DEVICE`: use the `accessibility` tool (see above) to activate this phone, then **retry** the play call
4. Confirm with spoken response: "Now playing {Artist} - {Track}"

## Workflow: Resume playback

1. Call `PUT /me/player/play` (no body) to resume
   - If `HTTP 404 / NO_ACTIVE_DEVICE`: use the `accessibility` tool to activate this phone, then retry

## Examples

- "Play Rammstein" → Search + artist URI + play (via API)
- "Next song" → POST /me/player/next (via API)
- "Pause" → PUT /me/player/pause (via API)
- "What's playing?" → GET /me/player/currently-playing + TTS (via API)
- "Louder" → Get current volume + increase + set volume (via API)
- "Resume playback" / "Continue playing" → PUT /me/player/play → if NO_ACTIVE_DEVICE: accessibility tool to select this phone, then retry
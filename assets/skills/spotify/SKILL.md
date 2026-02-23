---
name: spotify
description: Play and control music via Spotify
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

## Workflow: Play music

1. Search for artist/song using `http`
2. Get context URI or track URI from search results
3. Call play endpoint with the URI
4. Confirm with `tts`: "Now playing {Artist} - {Track}"

## Examples

- "Play Rammstein" → Search + artist URI + play
- "Next song" → POST /me/player/next
- "Pause" → PUT /me/player/pause
- "What's playing?" → GET /me/player/currently-playing + TTS
- "Louder" → Get current volume + increase + set volume

---
name: spotify
category: media
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

## Tool: accessibility (ONLY for starting playback when nothing is playing)

**IMPORTANT**: Use accessibility ONLY to start playback when Spotify is not playing. All other actions (pause, next, previous, volume, search, play specific tracks) MUST be done via the Web API.


When Spotify is not playing and the Web API play endpoint fails, use accessibility to open the app and click the "Play" button:

```json
{
  "package_name": "com.spotify.music",
  "goal": "Open the Spotify app and click the play button to start playback"
}
```

## Workflow: Play music

1. Search for artist/song using `http`
2. Get context URI or track URI from search results
3. Call play endpoint with the URI
4. Confirm with `tts`: "Now playing {Artist} - {Track}"

## Workflow: Resume playback when nothing is playing

If Spotify is currently not playing anything:

1. Check current playback status using `GET /me/player/currently-playing`
2. If the API returns 204 No Content or an empty response (nothing is playing):
   - Use the `accessibility` tool with `package_name: "com.spotify.music"` and `goal: "Open the Spotify app and click the play button to start playback"`
3. The accessibility tool will open the app and click the "Play" button automatically

**Note**: Once playback is started, all further control (pause, next, previous, volume) should be done via the Web API, NOT via accessibility.


## Examples

- "Play Rammstein" → Search + artist URI + play (via API)
- "Next song" → POST /me/player/next (via API)
- "Pause" → PUT /me/player/pause (via API)
- "What's playing?" → GET /me/player/currently-playing + TTS (via API)
- "Louder" → Get current volume + increase + set volume (via API)
- "Resume playback" / "Continue playing" → Check currently-playing → If nothing playing: accessibility tool to open app and click play (ONLY use accessibility for starting playback when nothing is playing)
---
name: podcast
category: media
description: Search, subscribe, and listen to podcasts. Download RSS feeds, manage episodes, and play audio with position tracking. Tools: http, file_storage, play_audio.
test_prompt: Search for a podcast about technology
permissions:
 - android.permission.INTERNET
---
# Podcast Skill

Search for podcasts, subscribe/unsubscribe, download RSS feeds, manage episodes, and play audio with automatic position tracking.

## Tools

| Tool | Purpose |
|------|---------|
| `http` | Fetch RSS feeds and search for podcasts |
| `file_storage` | Store subscribed podcasts and episode data |
| `play_audio` | Play, pause, resume, seek, and control audio playback |

**IMPORTANT:** For playing podcast episodes, ALWAYS use `play_audio` tool. NEVER use `intent` tool to open audio URLs in a browser or external app. The `play_audio` tool provides proper playback control, position tracking, and integrates with the podcast skill.

---

## Data Structure

All podcast data is stored in `file_storage` with filename `"podcasts"` and type `"text"`.

**Format (JSON):**

```json
{
  "subscriptions": [
    {
      "title": "Podcast Name",
      "rss_url": "https://example.com/feed.xml",
      "description": "Podcast description",
      "last_checked": 1234567890,
      "episodes": [
        {
          "title": "Episode Title",
          "url": "https://example.com/episode.mp3",
          "pub_date": "2024-01-01T00:00:00Z",
          "description": "Episode description",
          "status": "new",
          "guid": "unique-episode-id"
        }
      ]
    }
  ]
}
```

**Episode status values:**
- `"new"` – Episode not yet listened to
- `"listened"` – Episode has been played

Only the last 10 episodes per podcast are kept in the file.

---

## Workflows

### Search for a podcast

Examples: "Search for podcast about technology" / "Find podcast RSS feed for [name]"

1. `http` → GET `https://itunes.apple.com/search?media=podcast&term={QUERY}` with `response_format: "json"`
   - **Important:** Use the search query exactly as provided by the user. Do NOT add words like "podcast" or "RSS feed" to the query. Use only the podcast name/title the user is searching for.
   - URL-encode the query term (e.g., "Doppelgänger" becomes "Doppelg%C3%A4nger")
2. Parse JSON response:
   - The API returns a JSON object with `resultCount` and `results` array
   - Each result in `results` contains:
     - `collectionName` - podcast name
     - `feedUrl` - RSS feed URL (this is what we need!)
     - `artistName` - author/creator name
     - `artworkUrl100` or `artworkUrl600` - podcast artwork
     - `collectionId` - unique podcast ID
3. For each podcast in the results (limit to top 2-3):
   - Extract `feedUrl` directly from the JSON result (no need to parse HTML)
   - Validate RSS feed: `http` → GET feed URL with `response_format: "text"` to check if it's valid XML
4. Present results: "I found these podcasts: 1. [Name] by [Artist] - [Description] 2. [Name] by [Artist] - [Description] ..."
   - **Do NOT mention URLs or RSS feed links** in the response
   - Only mention podcast names, artist names, and descriptions
   - If user wants to subscribe, ask which one or subscribe to the first match

**Note:** If multiple results, ask the user which one they want to subscribe to, or subscribe to the first/best match.

---

### Subscribe to a podcast

Examples: "Subscribe to [podcast name]" / "Add podcast [RSS URL]"

1. `file_storage` → `read` filename: "podcasts", type: "text"
2. Parse existing subscriptions (or initialize empty array if file doesn't exist)
3. If RSS URL not provided, search for it first (see "Search for a podcast" workflow)
4. `http` → GET RSS feed URL with `response_format: "text"`
5. Parse XML:
   - Extract `<channel><title>` for podcast name
   - Extract `<channel><description>` for podcast description
   - **IMPORTANT: Extract ALL available episodes from the feed:**
     - Extract `<item>` elements for episodes:
       - `<title>` – episode title
       - `<enclosure url="...">` or `<link>` – episode audio URL
       - `<pubDate>` – publication date
       - `<description>` – episode description
       - `<guid>` – unique episode ID (or use URL if no guid)
     - **Do NOT limit to 10 episodes at this point** - extract all episodes from the feed
6. **Keep only the last 10 episodes** (most recent by `pub_date`), mark all as `"new"`
7. Add new subscription to array (check for duplicates by RSS URL) **with all extracted episodes**
8. `file_storage` → `write` filename: "podcasts", content: updated JSON, type: "text"
9. Confirm: "Podcast '[Name]' has been subscribed. Found [X] episodes."

---

### Unsubscribe from a podcast

Examples: "Unsubscribe from [podcast name]" / "Remove podcast [name]"

1. `file_storage` → `read` filename: "podcasts", type: "text"
2. Find subscription by title (case-insensitive, partial match allowed)
3. Remove from subscriptions array
4. `file_storage` → `write` filename: "podcasts", content: updated JSON, type: "text"
5. Confirm: "Podcast '[Name]' has been unsubscribed."

---

### Update RSS feed (single podcast or all)

Examples: "Update podcasts" / "Check for new episodes" / "Refresh [podcast name]"

1. `file_storage` → `read` filename: "podcasts", type: "text"
2. **If specific podcast requested:**
   - Find subscription by title
   - Update only that podcast
3. **If all podcasts:**
   - Update all subscriptions
4. For each podcast to update:
   - `http` → GET RSS feed URL with `response_format: "text"`
   - Parse XML: extract new `<item>` episodes
   - Compare with existing episodes (by `guid` or `url`)
   - Add new episodes (status: `"new"`)
   - Keep only the last 10 episodes (most recent)
   - Update `last_checked` timestamp
5. `file_storage` → `write` filename: "podcasts", content: updated JSON, type: "text"
6. Count total new episodes across all updated podcasts
7. Announce: "Found [X] new episodes across [Y] podcasts." or "No new episodes."

---

### Play an episode

Examples: "Play [episode title]" / "Play latest episode of [podcast name]" / "Play episode [number] of [podcast]"

**CRITICAL: You MUST use `play_audio` tool, NOT `intent` tool. Using `intent` will open the URL in a browser instead of playing audio.**

1. `file_storage` → `read` filename: "podcasts", type: "text"
2. Find podcast:
   - If podcast name specified: find by name (case-insensitive, partial match)
   - If episode title specified: search all podcasts for the episode
3. **IMPORTANT: Before playing, always update the RSS feed for the podcast:**
   - `http` → GET RSS feed URL with `response_format: "text"` to get latest feed
   - Parse XML: extract new `<item>` episodes
   - Compare with existing episodes (by `guid` or `url`)
   - Update episode list with any new episodes
   - `file_storage` → `write` filename: "podcasts", content: updated JSON, type: "text"
4. Find episode in updated data:
   - If episode title specified: search by title (case-insensitive, partial match)
   - If "latest" or "newest": find most recent episode (by `pub_date`)
   - If episode number: count episodes and select by index
   - If podcast name + episode: find podcast first, then episode
5. Get episode URL from the episode data
6. **Use `play_audio` tool with action `"play"` and the episode URL:**
   ```json
   {
     "tool": "play_audio",
     "args": {
       "action": "play",
       "url": "https://example.com/episode.mp3"
     }
   }
   ```
7. Confirm: "Playing '[Episode Title]' from '[Podcast Name]'."

**Note:** The `play_audio` tool automatically restores the last saved position if the episode was previously played. Do NOT use `intent` tool for podcast episodes.

---

### Control playback

#### Pause

Examples: "Pause" / "Stop playing"

1. `play_audio` → `pause`
2. Confirm: "Paused."

#### Resume

Examples: "Resume" / "Continue" / "Play"

1. `play_audio` → `resume`
2. Confirm: "Resuming playback."

#### Seek forward/backward

Examples: "Skip one minute" / "Go back 30 seconds" / "Skip forward 2 minutes"

1. Parse time offset from user request (e.g., "one minute" = 60 seconds, "30 seconds" = 30)
2. Determine direction: "forward", "skip", "ahead" = positive; "back", "backward", "rewind" = negative
3. `play_audio` → `seek` with `offset_seconds: [calculated offset]`, `isRelative: true`
4. Confirm: "Skipped [direction] by [time]."

#### Restart episode

Examples: "Start from beginning" / "Restart"

1. `play_audio` → `seek` with `position_seconds: 0`, `isRelative: false`
2. Confirm: "Restarted from the beginning."

---

### Query playback status

#### What is playing?

Examples: "What are you playing?" / "What's currently playing?"

1. `play_audio` → `status`
2. If playing: "Currently playing: [Episode Title] from [Podcast Name]."
3. If paused: "Paused: [Episode Title]."
4. If stopped: "Nothing is currently playing."
5. **Do NOT mention URLs or technical details** – only mention episode and podcast names.

#### How much time remaining?

Examples: "How long left?" / "How much time remaining?"

1. `play_audio` → `status`
2. Extract `duration` and `position` from status
3. Calculate: `remaining = duration - position`
4. Announce: "[X] minutes [Y] seconds remaining." or "Episode is complete."

#### Current position

Examples: "Where are we?" / "What time is it?"

1. `play_audio` → `status`
2. Announce: "At [X] minutes [Y] seconds of [duration]."

---

### Mark episode as listened

Examples: "Mark as listened" / "Mark [episode] as heard"

1. `file_storage` → `read` filename: "podcasts", type: "text"
2. Find episode (by current playing URL, or by title if specified)
3. Set episode `status` to `"listened"`
4. `file_storage` → `write` filename: "podcasts", content: updated JSON, type: "text"
5. Confirm: "Marked '[Episode Title]' as listened."

**Note:** Episodes are automatically marked as listened when playback completes (via `play_audio` completion event), but the user can also manually mark them.

---

### List subscribed podcasts

Examples: "What podcasts am I subscribed to?" / "List my podcasts"

1. `file_storage` → `read` filename: "podcasts", type: "text"
2. Parse subscriptions array
3. For each podcast:
   - Count episodes with status `"new"`
   - Format: "[Name] - [X] new episodes"
4. Present: "You are subscribed to [N] podcasts: 1. [Name] - [X] new, 2. ..."

---

### List episodes of a podcast

Examples: "What episodes does [podcast] have?" / "Show episodes of [podcast]"

1. `file_storage` → `read` filename: "podcasts", type: "text"
2. Find podcast by name (case-insensitive, partial match)
3. List episodes:
   - Format: "[Number]. [Title] ([Status]) - [Pub Date]"
   - Status: "new" or "listened"
4. Present: "Episodes of '[Podcast Name]': 1. [Title] (new), 2. ..."

---

## RSS Feed Parsing Rules

### RSS 2.0 Format

- Channel info: `<channel><title>`, `<channel><description>`
- Episodes: `<item>` elements
  - Title: `<title>`
  - Audio URL: `<enclosure url="..." type="audio/...">` (preferred) or `<link>`
  - Publication date: `<pubDate>`
  - Description: `<description>` (may contain HTML – strip tags)
  - GUID: `<guid>` (use as unique ID, or fallback to URL)

### Atom Format

- Feed info: `<feed><title>`, `<feed><subtitle>`
- Episodes: `<entry>` elements
  - Title: `<title>`
  - Audio URL: `<link rel="enclosure" href="...">` or `<link href="...">`
  - Publication date: `<published>` or `<updated>`
  - Description: `<summary>` or `<content>`
  - GUID: `<id>`

### HTML Stripping

- Remove HTML tags from descriptions: `<p>`, `<br>`, `<a>`, etc.
- Remove CDATA wrappers: `<![CDATA[...]]>`
- Decode HTML entities if needed

---

## Podcast Search Source

### iTunes/Apple Podcasts Search API

**Step 1: Search for podcasts**

```json
{
  "method": "GET",
  "url": "https://itunes.apple.com/search?media=podcast&term={QUERY}",
  "response_format": "json"
}
```

**Important:** 
- Use the search query exactly as provided by the user. Do NOT add words like "podcast" or "RSS feed" to the query.
- URL-encode the query term properly (e.g., spaces become `%20`, special characters like "ä" become `%C3%A4`)
- If the user searches for "doppelgänger", use exactly "doppelgänger" in the URL (URL-encoded), not "doppelgänger podcast" or "doppelgänger RSS feed".

**Response format:**
The API returns JSON with this structure:
```json
{
  "resultCount": 2,
  "results": [
    {
      "collectionName": "Podcast Name",
      "feedUrl": "https://example.com/feed.xml",
      "artistName": "Author Name",
      "artworkUrl100": "https://...",
      "collectionId": 123456789
    }
  ]
}
```

**Step 2: Extract RSS feed URL**

The `feedUrl` field in each result contains the RSS feed URL directly - no HTML parsing needed! Simply extract it from the JSON response.

For each podcast in the results (limit to top 2-3):
- Extract `feedUrl` from the JSON result
- Validate RSS feed: `http` → GET feed URL with `response_format: "text"` to check if it's valid XML

---

## Position Tracking

The `play_audio` tool automatically tracks playback position per audio file:

- Position is saved in `file_storage` file `"audio_positions"` (JSON format)
- When starting playback, the tool automatically restores the last saved position
- Position is saved:
  - When playback is paused
  - When playback completes (entry is removed)
  - Periodically during playback (every 10 seconds)

**Format:**
```json
{
  "https://example.com/episode.mp3": {
    "position_seconds": 123,
    "timestamp": 1234567890
  }
}
```

---

## Error Handling

- **Invalid RSS feed:** Report error, but don't crash. Skip that podcast in updates.
- **Network errors:** Retry once, then report to user.
- **Audio playback errors:** Report clearly: "Failed to play audio: [error]"
- **Missing episodes:** If episode not found, suggest similar episodes or ask for clarification.

---

## Output Format Rules

- **Voice (TTS):** Keep responses concise (1-2 sentences). For status queries, give time in minutes:seconds format.
- **Text response:** Provide detailed information including episode titles, podcast names, dates, and status.
- **Always** confirm actions: "Subscribed to...", "Playing...", "Paused.", etc.
- **Episode lists:** Show max 10 episodes to avoid overwhelming the user.
- **Time formats:** Use "X minutes Y seconds" for voice, "MM:SS" for text.
- **NEVER mention URLs, RSS feed links, or technical details** in responses to the user. Only mention podcast names, episode titles, descriptions, and status information.
- **Keep responses user-friendly** – focus on what the user cares about (podcast names, episode titles, playback status), not technical implementation details.

---

## Examples

- "Search for podcast about artificial intelligence" → Search and present results
- "Subscribe to [podcast name]" → Subscribe and confirm
- "Update podcasts" → Check all feeds, announce new episodes
- "Play latest episode of [podcast]" → Find episode, use `play_audio` tool (NOT `intent`) to play
- "Pause" → Pause current playback
- "Skip one minute forward" → Seek +60 seconds
- "What are you playing?" → Get status and announce
- "How long left?" → Calculate and announce remaining time
- "Mark as listened" → Update episode status
- "List my podcasts" → Show all subscriptions with new episode counts

---

## Important Rules

1. **ALWAYS use `play_audio` tool for podcast episodes** – Never use `intent` tool to open audio URLs. Using `intent` will open the URL in a browser instead of playing audio.
2. **Audio URLs are for playback, not browsing** – Episode URLs should be passed to `play_audio` with action `"play"`, not opened with `intent`.
3. **Position tracking only works with `play_audio`** – The `play_audio` tool automatically handles position tracking; this functionality is lost if you use `intent` instead.

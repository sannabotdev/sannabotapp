---
name: calendar
description: Read Google Calendar and manage appointments
test_prompt: Fetch the next 3 appointments from the calendar
permissions:
 - android.permission.INTERNET
credentials:
 - id: google_credentials
   label: Google Account
   type: oauth
   auth_provider: google
---
# Google Calendar Skill

Read and create appointments via the Google Calendar API.

## Tool: http

All requests require `auth_provider: "google"`.

Base URL: `https://www.googleapis.com/calendar/v3`

### Fetch today's/upcoming events

```json
{
  "method": "GET",
  "url": "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={ISO_DATE_NOW}&maxResults=10&singleEvents=true&orderBy=startTime",
  "auth_provider": "google"
}
```

Example for `timeMin`: `2024-01-15T00:00:00Z` (ISO 8601 UTC)

### Events for a specific time range

```json
{
  "method": "GET",
  "url": "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={START}&timeMax={END}&singleEvents=true&orderBy=startTime",
  "auth_provider": "google"
}
```

### Create an event

```json
{
  "method": "POST",
  "url": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  "auth_provider": "google",
  "body": {
    "summary": "{TITLE}",
    "start": {
      "dateTime": "{ISO_START}",
      "timeZone": "Europe/Vienna"
    },
    "end": {
      "dateTime": "{ISO_END}",
      "timeZone": "Europe/Vienna"
    },
    "description": "{DESCRIPTION}"
  }
}
```

## Generating ISO dates

Current time: Use the `device` tool with `get_time` to get the current time, then calculate.

Examples:
- "Today at 2 PM" → `2024-01-15T14:00:00+01:00`
- "Tomorrow at 9:00" → tomorrow's date + T09:00:00+01:00
- Austria/Central Europe: timezone is `Europe/Vienna` (UTC+1 / UTC+2 in summer)

## Workflow: Read events aloud

1. Fetch events (timeMin = now)
2. Parse response: `items[].summary`, `items[].start.dateTime`
3. Read aloud with `tts`: "You have a meeting at 2 PM with..."

## Examples

- "What do I have today?" → Fetch today's events + TTS
- "What is my next appointment?" → maxResults=1 + TTS
- "Create an appointment tomorrow at 10 AM" → POST event
- "Am I free next Monday?" → Fetch events for that day

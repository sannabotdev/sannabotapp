---
name: calendar
category: productivity
description: Read, create, update, move and delete Google Calendar events
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

Read, create, update, move and delete appointments via the Google Calendar API.

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

### Update an event (partial – PATCH)

Use PATCH to change only specific fields of an existing event. You need the `eventId` from a previous GET request.

```json
{
  "method": "PATCH",
  "url": "https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}",
  "auth_provider": "google",
  "body": {
    "summary": "{NEW_TITLE}",
    "start": {
      "dateTime": "{NEW_ISO_START}",
      "timeZone": "Europe/Vienna"
    },
    "end": {
      "dateTime": "{NEW_ISO_END}",
      "timeZone": "Europe/Vienna"
    },
    "description": "{NEW_DESCRIPTION}",
    "location": "{NEW_LOCATION}"
  }
}
```

Only include the fields you want to change – omitted fields stay unchanged.

Updatable fields:
- `summary` – title
- `description` – notes / description
- `start` / `end` – date and time (both must be provided together)
- `location` – place
- `colorId` – color label (string "1" through "11")
- `reminders` – reminder overrides
- `attendees` – list of attendees (email addresses)

### Move an event (change time)

Moving an event to a different time is just a PATCH with new `start` and `end`:

```json
{
  "method": "PATCH",
  "url": "https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}",
  "auth_provider": "google",
  "body": {
    "start": {
      "dateTime": "{NEW_ISO_START}",
      "timeZone": "Europe/Vienna"
    },
    "end": {
      "dateTime": "{NEW_ISO_END}",
      "timeZone": "Europe/Vienna"
    }
  }
}
```

### Move an event to another calendar

```json
{
  "method": "POST",
  "url": "https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}/move?destination={TARGET_CALENDAR_ID}",
  "auth_provider": "google"
}
```

### Delete an event

```json
{
  "method": "DELETE",
  "url": "https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}",
  "auth_provider": "google"
}
```

Returns HTTP 204 (no body) on success.

## Finding the eventId

To update, move or delete an event you need its `eventId`. Get it by fetching events first:

1. Fetch events with GET (see above)
2. Each event in `items[]` has an `id` field – that is the `eventId`
3. Match the correct event by `summary`, `start.dateTime` or other fields

**Important**: Always fetch events first and confirm the correct event with the user before modifying or deleting it.

## Generating ISO dates

Current time: Use the `device` tool with `get_time` to get the current time, then calculate.

Examples:
- "Today at 2 PM" → `2024-01-15T14:00:00+01:00`
- "Tomorrow at 9:00" → tomorrow's date + T09:00:00+01:00
- Germany/Central Europe: timezone is `Europe/Berlin` (UTC+1 / UTC+2 in summer)

## Workflows

### Read events aloud

1. Fetch events (timeMin = now)
2. Parse response: `items[].summary`, `items[].start.dateTime`
3. Read aloud with `tts`: "You have a meeting at 2 PM with..."

### Move an event to a different time

1. `device`: `get_time` → current time
2. Fetch events with GET to find the target event
3. Identify the correct event by name/time → extract `id`
4. Calculate the new start/end timestamps
5. PATCH the event with new `start` and `end`
6. Confirm to user via `tts`: "Your meeting has been moved to 3 PM"

### Update event details

1. Fetch events to find the target event → extract `id`
2. PATCH the event with the changed fields (e.g. new title, description, location)
3. Confirm to user via `tts`

### Delete an event

1. Fetch events to find the target event → extract `id`
2. Confirm with the user which event to delete
3. DELETE the event
4. Confirm to user via `tts`: "The event has been deleted"

### Reschedule by a relative amount ("push meeting 1 hour later")

1. `device`: `get_time` → current time
2. Fetch the event to get current `start.dateTime` and `end.dateTime`
3. Add the offset (e.g. +1 hour) to both start and end
4. PATCH with the new times
5. Confirm via `tts`

## Examples

- "What do I have today?" → Fetch today's events + TTS
- "What is my next appointment?" → maxResults=1 + TTS
- "Create an appointment tomorrow at 10 AM" → POST event
- "Am I free next Monday?" → Fetch events for that day
- "Move the 2 PM meeting to 4 PM" → GET events, find it, PATCH with new time
- "Push my next meeting back by 30 minutes" → GET event, add 30 min, PATCH
- "Rename my dentist appointment to doctor" → GET events, PATCH summary
- "Change the location of the team meeting to Room 5" → GET events, PATCH location
- "Delete the meeting at 3 PM" → GET events, find it, DELETE
- "Cancel tomorrow's breakfast meeting" → GET tomorrow's events, DELETE
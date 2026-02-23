---
name: scheduler
description: Schedule time-based tasks – a sub-agent executes any instruction in the background
test_prompt: List all existing schedules
permissions:
 - android.permission.SCHEDULE_EXACT_ALARM
---
# Scheduler Skill

Schedule tasks for the future. At the scheduled time, a sub-agent (mini AI) runs in the background and executes the stored instruction with all available tools.

**Examples**: Send SMS at a scheduled time, reminders, recurring queries, repeating tasks.

## Tool: scheduler

### Create a schedule

```json
{
  "action": "create",
  "instruction": "{NATURAL_LANGUAGE_INSTRUCTION}",
  "trigger_at_ms": {TIMESTAMP_MS},
  "recurrence_type": "once"
}
```

The `instruction` is the command the sub-agent will execute. Write it as if you were giving Sanna the command directly. The sub-agent has access to all tools (SMS, HTTP, TTS, Intent, etc.).

**IMPORTANT**: The instruction must contain everything the sub-agent needs. It has no context of the current conversation. For example, include the phone number directly rather than "Peter's number".

### Recurring schedules

#### Interval (every X minutes/hours)

```json
{
  "action": "create",
  "instruction": "{INSTRUCTION}",
  "trigger_at_ms": {FIRST_TRIGGER_MS},
  "recurrence_type": "interval",
  "recurrence_interval_ms": {INTERVAL_IN_MS}
}
```

Example "every 30 minutes": `recurrence_interval_ms: 1800000`

#### Daily

```json
{
  "action": "create",
  "instruction": "{INSTRUCTION}",
  "trigger_at_ms": {NEXT_TRIGGER_MS},
  "recurrence_type": "daily",
  "recurrence_time": "08:00"
}
```

#### Weekly

```json
{
  "action": "create",
  "instruction": "{INSTRUCTION}",
  "trigger_at_ms": {NEXT_TRIGGER_MS},
  "recurrence_type": "weekly",
  "recurrence_time": "09:00",
  "recurrence_days_of_week": [1, 3, 5]
}
```

Days of week: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun

### List all schedules

```json
{
  "action": "list"
}
```

### Get a single schedule

```json
{
  "action": "get",
  "schedule_id": "{ID}"
}
```

### Update a schedule

```json
{
  "action": "update",
  "schedule_id": "{ID}",
  "instruction": "{NEW_INSTRUCTION}",
  "trigger_at_ms": {NEW_TIMESTAMP}
}
```

Only the specified fields are changed; the rest remains the same.

### Delete a schedule

```json
{
  "action": "delete",
  "schedule_id": "{ID}"
}
```

### Disable a schedule (pause)

```json
{
  "action": "disable",
  "schedule_id": "{ID}"
}
```

### Enable a schedule

```json
{
  "action": "enable",
  "schedule_id": "{ID}"
}
```

## Time calculation

**IMPORTANT**: `trigger_at_ms` is a Unix timestamp in **milliseconds**.

### Workflow for time calculation

1. Get current time with `device` tool (`get_time`)
2. Calculate the desired point in time
3. Provide as millisecond timestamp

### Examples

- "in 3 minutes": `now + 3 * 60 * 1000`
- "in an hour": `now + 60 * 60 * 1000`
- "at 2:00 PM": current date + 14:00 in Europe/Vienna
- "tomorrow at 9": tomorrow's date + 09:00

### Time zones

Central Europe: Europe/Vienna (UTC+1 winter, UTC+2 summer)

## Writing instructions

The sub-agent is a standalone agent with no conversation context. The instruction must be self-explanatory:

**Good**:
- `"Send an SMS to +4366012345678 with the text: I'll be there in 10 minutes"`
- `"Speak via TTS: Attention, the roast needs to come out of the oven!"`
- `"Fetch the Google Calendar events and read the next 3 appointments via TTS"`

**Bad**:
- `"Send Peter an SMS"` (Who is Peter? What should the SMS say?)
- `"Remind me"` (About what? Context is missing.)

For contacts: Look up the number first with the `query` tool and include it directly in the instruction.

## Workflows

### "Remind me in 5 minutes about the roast"

1. `device`: `get_time` → current time
2. Calculate: `now + 5 * 60 * 1000`
3. `scheduler`: `create` with:
   - `instruction`: `"Speak via TTS: Attention! The roast needs to come out of the oven!"`
   - `trigger_at_ms`: calculated timestamp
   - `recurrence_type`: `"once"`

### "Send an SMS to Peter at 2 PM: on my way"

1. `query`: Look up contact "Peter" → get number
2. `device`: `get_time` → current time
3. Calculate timestamp for 14:00 today
4. `scheduler`: `create` with:
   - `instruction`: `"Send an SMS to +4366012345678 with the text: On my way"`
   - `trigger_at_ms`: 14:00 timestamp
   - `recurrence_type`: `"once"`

### "Read my appointments every morning at 8"

1. `device`: `get_time` → current time
2. Calculate timestamp for tomorrow 08:00
3. `scheduler`: `create` with:
   - `instruction`: `"Fetch my Google Calendar events for today and read them via TTS"`
   - `trigger_at_ms`: tomorrow 08:00
   - `recurrence_type`: `"daily"`
   - `recurrence_time`: `"08:00"`

### "What do I have scheduled?"

1. `scheduler`: `list`
2. Report results to user

### "Delete the alarm / reminder"

1. `scheduler`: `list` → find the relevant schedule
2. `scheduler`: `delete` with the found ID

### "Pause the daily calendar check"

1. `scheduler`: `list` → find the schedule
2. `scheduler`: `disable` with the ID

## Notes

- Schedules survive app restarts and device reboots
- The sub-agent has the same tools as the main app (except the scheduler itself)
- For reminders: always use `tts` in the instruction so the user can hear it
- SMS instructions require the phone number (not the contact name)
- Intervals under 1 minute are not allowed
- The app must have been launched at least once for schedules to work

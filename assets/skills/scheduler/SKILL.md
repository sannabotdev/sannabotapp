---
name: scheduler
category: productivity
description: Schedule time-based tasks – a sub-agent executes any instruction in the background
test_prompt: List all existing schedules
exclusive_tool: scheduler
permissions:
 - android.permission.SCHEDULE_EXACT_ALARM
---
# Scheduler Skill

Schedule tasks for the future (minimum 1 minute ahead). At the scheduled time, a sub-agent (mini AI) runs in the background and executes the stored instruction with all available tools.

**Examples**: Send SMS at a scheduled time, reminders, recurring queries, repeating tasks.

**NOT suitable for**: Short timers under 1 minute (use the `beep` tool directly instead).

## Tool: scheduler

### Create a schedule

```json
{
  "action": "create",
  "label": "{OPTIONAL_USER_FRIENDLY_HEADLINE}",
  "instruction": "{NATURAL_LANGUAGE_INSTRUCTION}",
  "trigger_at_ms": {TIMESTAMP_MS},
  "recurrence_type": "once"
}
```

The `label` is an optional user-friendly headline for the schedule (e.g. "Morning reminder", "Daily calendar check"). If provided, it will be displayed prominently in the UI instead of the instruction text.

The `instruction` is the command the sub-agent will execute. Write it as if you were giving Sanna the command directly. The sub-agent has access to all tools (SMS, HTTP, TTS, beep, Intent, etc.).

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
  "label": "{NEW_LABEL}",
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

**IMPORTANT**: `trigger_at_ms` is a Unix timestamp in **milliseconds**. The trigger must be **at least 1 minute** in the future.

### Workflow for time calculation

**For relative times** ("in 5 minutes", "in an hour"):
1. Get current time with `device` tool (`get_time`) — this returns `now_ms`
2. Compute `now_ms + offset_in_ms`
   - "in 5 minutes": `now_ms + 300000`
   - "in an hour": `now_ms + 3600000`

**For absolute times** ("next Tuesday at 8 PM", "tomorrow at 9", "on March 5 at 14:00"):
1. Use `device` tool with `get_date_timestamp` — this returns the **exact** Unix timestamp. **Do NOT calculate manually.**
2. Parameters:
   - `date`: `"today"`, `"tomorrow"`, `"next_monday"`–`"next_sunday"`, `"in_2_weeks"`–`"in_4_weeks"`, `"next_month"`, `"next_year"`, or `"YYYY-MM-DD"`
   - `time`: `"HH:MM"` (e.g. `"20:00"`)
   - `unit`: `"milliseconds"`
3. Use the returned timestamp directly as `trigger_at_ms`.

### Examples

- "in 5 minutes" → `device` `get_time`, then `now_ms + 300000`
- "tomorrow at 9" → `device` `get_date_timestamp` with `date: "tomorrow"`, `time: "09:00"`, `unit: "milliseconds"`
- "next Tuesday at 8 PM" → `device` `get_date_timestamp` with `date: "next_tuesday"`, `time: "20:00"`, `unit: "milliseconds"`
- "in two weeks at noon" → `device` `get_date_timestamp` with `date: "in_2_weeks"`, `time: "12:00"`, `unit: "milliseconds"`
- "in three weeks" → `device` `get_date_timestamp` with `date: "in_3_weeks"`, `time: "09:00"`, `unit: "milliseconds"`
- "next month at 10 AM" → `device` `get_date_timestamp` with `date: "next_month"`, `time: "10:00"`, `unit: "milliseconds"`
- "next year" → `device` `get_date_timestamp` with `date: "next_year"`, `time: "09:00"`, `unit: "milliseconds"`
- "on March 5 at 2 PM" → `device` `get_date_timestamp` with `date: "2026-03-05"`, `time: "14:00"`, `unit: "milliseconds"`

**CRITICAL**: For any date/weekday-based scheduling, ALWAYS use `get_date_timestamp`. Do NOT compute day offsets or timestamps manually — this causes calculation errors.

## Writing instructions

The sub-agent is a standalone agent with no conversation context. The instruction must be self-explanatory:

**Good**:
- `"Speak via TTS: Attention, the roast needs to come out of the oven!"`
- `"Use the beep tool to play an alarm tone (tone: alarm, count: 5), then speak via TTS: Timer finished!"`
- `"Send an SMS to +4366012345678 with the text: I'll be there in 10 minutes"`
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
   - `instruction`: `"Use the beep tool (tone: alarm, count: 5). Then speak via TTS: The roast needs to come out of the oven!"`
   - `trigger_at_ms`: calculated timestamp
   - `recurrence_type`: `"once"`
4. Confirm to the user: "I'll remind you in 5 minutes."

### "Send an SMS to Peter at 2 PM: on my way"

1. `query`: Look up contact "Peter" → get number
2. `device`: `get_date_timestamp` with `date: "today"`, `time: "14:00"`, `unit: "milliseconds"` → get exact timestamp
3. `scheduler`: `create` with:
   - `instruction`: `"Send an SMS to +4366012345678 with the text: On my way"`
   - `trigger_at_ms`: timestamp from step 2
   - `recurrence_type`: `"once"`

### "Read my appointments every morning at 8"

1. `device`: `get_date_timestamp` with `date: "tomorrow"`, `time: "08:00"`, `unit: "milliseconds"` → get exact timestamp
2. `scheduler`: `create` with:
   - `instruction`: `"Fetch my Google Calendar events for today and read them via TTS"`
   - `trigger_at_ms`: timestamp from step 1
   - `recurrence_type`: `"daily"`
   - `recurrence_time`: `"08:00"`

### "What do I have scheduled?"

1. `scheduler`: `list`
2. Report results to user (describe by instruction and time, NOT by ID)

### "Delete the alarm / reminder"

1. `scheduler`: `list` → find the relevant schedule
2. `scheduler`: `delete` with the found ID

### "Pause the daily calendar check"

1. `scheduler`: `list` → find the schedule
2. `scheduler`: `disable` with the ID

## Important rules

- **Minimum 1 minute**: The scheduler only works for tasks at least 1 minute in the future. For immediate sounds, use the `beep` tool directly.
- **Never show IDs**: Schedule IDs are internal. When talking to the user, describe schedules by their task and time (e.g. "your roast reminder at 3:15 PM"), never by ID.
- **Reminders**: Use `beep` + `tts` in the instruction so the user hears both a tone and the message.
- Schedules survive app restarts and device reboots.
- The sub-agent has the same tools as the main app (except the scheduler itself).
- SMS instructions require the phone number (not the contact name).
- Intervals under 1 minute are not allowed.
- The app must have been launched at least once for schedules to work.

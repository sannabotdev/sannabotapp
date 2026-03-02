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

Schedule complex tasks for the future. At the scheduled time, a sub-agent (mini AI) runs in the background and executes the stored instruction with all available tools (SMS, HTTP, TTS, beep, Intent, etc.).

**Use the scheduler tool for**:
- Tasks that need execution (e.g. "send SMS", "remind me to call", "check calendar", "play alarm and speak")
- Recurring tasks (daily, weekly, interval)

**Examples**: "Remind me in 10 minutes to call Peter", "Send SMS tomorrow at 9 AM", "Check calendar every day at 8 AM"

**NOT suitable for**: Simple countdown timers that only need an acoustic alarm. Use the `timer` tool instead for timers that just play a beep when time is up.

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

Example "every 30 minutes": Use `datetime` tool with `action: "interval"`, `amount: 30`, `interval_unit: "minute"` → returns `1800000` (use as `recurrence_interval_ms`)

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

**For relative times** ("in 5 minutes", "in an hour", "in 2 weeks"):
1. Use `datetime` tool with `action: "add"`, `base: "now"`, `amount: {N}`, `unit: "{unit}"`
   - "in 5 minutes": `datetime add` with `base: "now"`, `amount: 5`, `unit: "minute"`
   - "in an hour": `datetime add` with `base: "now"`, `amount: 1`, `unit: "hour"`
   - "in 2 weeks": `datetime add` with `base: "now"`, `amount: 2`, `unit: "week"`

**For absolute times** ("tomorrow at 9", "next Tuesday at 8 PM", "next January", "on 2024-03-15"):
1. Use `datetime` tool with `action: "absolute"` — this returns the **exact** Unix timestamp. **Do NOT calculate manually.**
2. Parameters:
   - `base`: Enum value (`"today"`, `"tomorrow"`, `"yesterday"`, `"next_monday"`–`"next_sunday"`, `"next_january"`–`"next_december"`), Unix timestamp in milliseconds (number), or ISO date/datetime string (e.g. `"2024-03-15"`, `"2024-03-15T14:00:00"`, `"2024-03-15T14:00:00Z"`)
   - `time` (optional): `"HH:MM"` or `"HH:MM:SS"` (e.g. `"09:00"`, `"20:00"`)
   - `anchor` (optional): `"beginofday"`, `"endofday"`, `"beginofweek"`, `"endofweek"`, `"beginofmonth"`, `"endofmonth"`
   - `output_unit`: `"milliseconds"` (default) or `"seconds"`
3. Use the returned timestamp directly as `trigger_at_ms`.

**For interval calculations** (for `recurrence_interval_ms`):
1. Use `datetime` tool with `action: "interval"`, `amount: {N}`, `interval_unit: "{unit}"`
   - Returns milliseconds (use directly as `recurrence_interval_ms`)
   - Units: `"millisecond"`/`"ms"`, `"second"`, `"minute"`, `"hour"`, `"day"`, `"week"`, `"month"`, `"year"`

### Examples

- "in 5 minutes" → `datetime add` with `base: "now"`, `amount: 5`, `unit: "minute"` → use returned timestamp as `trigger_at_ms`
- "tomorrow at 9" → `datetime absolute` with `base: "tomorrow"`, `time: "09:00"`, `output_unit: "milliseconds"`
- "next Tuesday at 8 PM" → `datetime absolute` with `base: "next_tuesday"`, `time: "20:00"`, `output_unit: "milliseconds"`
- "in two weeks at noon" → `datetime add` with `base: "now"`, `amount: 2`, `unit: "week"`, then `datetime absolute` with `base: {result}`, `time: "12:00"` OR use `datetime add` with `base: "now"`, `amount: 2`, `unit: "week"`, `time: "12:00"`
- "next month at 10 AM" → `datetime absolute` with `base: "next_january"` (or current month + 1), `time: "10:00"`, `output_unit: "milliseconds"`
- "every 30 minutes" → `datetime interval` with `amount: 30`, `interval_unit: "minute"` → returns `1800000` → use as `recurrence_interval_ms`

**CRITICAL**: For any date/time calculations, ALWAYS use the `datetime` tool. Do NOT compute timestamps manually — this causes calculation errors.

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

1. `datetime`: `add` with `base: "now"`, `amount: 5`, `unit: "minute"` → get timestamp
2. `scheduler`: `create` with:
   - `instruction`: `"Use the beep tool (tone: alarm, count: 5). Then speak via TTS: The roast needs to come out of the oven!"`
   - `trigger_at_ms`: timestamp from step 1
   - `recurrence_type`: `"once"`
3. Confirm to the user: "I'll remind you in 5 minutes."

### "Send an SMS to Peter at 2 PM: on my way"

1. `query`: Look up contact "Peter" → get number
2. `datetime`: `absolute` with `base: "today"`, `time: "14:00"`, `output_unit: "milliseconds"` → get exact timestamp
3. `scheduler`: `create` with:
   - `instruction`: `"Send an SMS to +4366012345678 with the text: On my way"`
   - `trigger_at_ms`: timestamp from step 2
   - `recurrence_type`: `"once"`

### "Read my appointments every morning at 8"

1. `datetime`: `absolute` with `base: "tomorrow"`, `time: "08:00"`, `output_unit: "milliseconds"` → get exact timestamp
2. `scheduler`: `create` with:
   - `instruction`: `"Fetch my Google Calendar events for today and read them via TTS"`
   - `trigger_at_ms`: timestamp from step 1
   - `recurrence_type`: `"daily"`
   - `recurrence_time`: `"08:00"`

### "Announce the time every minute"

1. `datetime`: `add` with `base: "now"`, `amount: 1`, `unit: "minute"` → get first trigger timestamp
2. `datetime`: `interval` with `amount: 1`, `interval_unit: "minute"` → get interval in ms (60000)
3. `scheduler`: `create` with:
   - `instruction`: `"Speak via TTS: The current time is [current time]"`
   - `trigger_at_ms`: timestamp from step 1
   - `recurrence_type`: `"interval"`
   - `recurrence_interval_ms`: interval from step 2
4. Confirm to the user: "I'll announce the time every minute, starting in 1 minute."

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

---
name: timer
category: productivity
description: Simple timers and stopwatches – countdown timers with beep, stopwatches with status query
exclusive_tool: timer
permissions:
 - android.permission.SCHEDULE_EXACT_ALARM
---
# Timer Skill

Manage simple countdown timers and stopwatches. Unlike the scheduler (minimum 1 minute, sub-agent based), timers are designed for short durations (seconds to minutes) and use direct beep notifications.

**Use the timer tool for**:
- Short countdown timers (seconds, minutes) - e.g. "egg timer 20 seconds", "timer 3 minutes"
- Stopwatches for tracking elapsed time
- Simple reminders that just need a beep when time is up

**Examples**: "egg timer 20 seconds", "Set a timer for 3 minutes", "Start stopwatch for running", "timer 5 minutes"

**NOT suitable for**: Complex scheduled tasks or tasks longer than a few minutes (use the `scheduler` tool instead). The scheduler requires a minimum of 1 minute and uses a sub-agent to execute instructions.

## Tool: timer

### Start a countdown timer

```json
{
  "action": "start_timer",
  "duration_ms": 180000,
  "label": "3 minute timer"
}
```

The `duration_ms` is the countdown duration in milliseconds (e.g. 180000 = 3 minutes).

The `label` is optional. If provided, it will be used when describing the timer to the user.

When the timer expires, it will play a beep and be automatically removed from the list.

### Start a stopwatch

```json
{
  "action": "start_stopwatch",
  "label": "Running stopwatch"
}
```

The `label` is optional. Stopwatches count up from the start time and can be queried for elapsed time or stopped.

### List all active timers and stopwatches

```json
{
  "action": "list"
}
```

Returns all currently active timers and stopwatches.

### Get status of a timer or stopwatch

```json
{
  "action": "get_status",
  "timer_id": "timer_1234567890_abcd"
}
```

For countdown timers: Returns remaining time.
For stopwatches: Returns elapsed time.

### Stop a stopwatch

```json
{
  "action": "stop",
  "timer_id": "stopwatch_1234567890_abcd"
}
```

Stops the stopwatch and removes it from the list. Returns the final elapsed time.

**Note**: Can only be used on stopwatches. Use `cancel` to delete a countdown timer.

### Cancel a timer or stopwatch

```json
{
  "action": "cancel",
  "timer_id": "timer_1234567890_abcd"
}
```

Cancels and removes a timer or stopwatch from the list.

---

## Workflow: Set a timer

Examples: "egg timer 20 seconds", "Set a timer for 3 minutes" / "Timer for 5 minutes"

**IMPORTANT**: When the user asks for a timer (especially with "egg timer" or short durations in seconds), ALWAYS use the `timer` tool, NOT the `scheduler` tool. The scheduler is for complex tasks with a minimum of 1 minute.

**Time calculation**: Use `device` tool with `get_time` action to get the current time (`now_ms`) for any time-related calculations. Do NOT calculate timestamps manually.

1. Calculate duration in milliseconds (e.g. 20 seconds = 20000 ms, 3 minutes = 180000 ms)
2. `timer` → `start_timer` with:
   - `duration_ms`: calculated duration
   - `label` (optional): user-friendly label (e.g. "egg timer")
3. Confirm: "Timer started: 20 seconds" or "Timer started: 3 minutes"

---

## Workflow: Start a stopwatch

Examples: "Start stopwatch for running" / "Start a stopwatch"

1. `timer` → `start_stopwatch` with:
   - `label` (optional): user-friendly label (e.g. "Running")
2. Confirm: "Stopwatch started: Running"

---

## Workflow: Check stopwatch elapsed time

Examples: "How long has the stopwatch been running?" / "What's the elapsed time?"

1. `timer` → `list` → find the stopwatch by label or type
2. `timer` → `get_status` with the found `timer_id`
3. Report elapsed time to user: "The stopwatch has been running for 5 minutes and 23 seconds"

---

## Workflow: Stop a stopwatch

Examples: "Stop the running stopwatch" / "Stop the stopwatch"

1. `timer` → `list` → find the stopwatch by label
2. `timer` → `stop` with the found `timer_id`
3. Confirm: "Stopwatch stopped: 5 minutes 23 seconds"

---

## Workflow: List all timers

Examples: "What timers are running?" / "Show me all timers"

1. `timer` → `list`
2. Report all active timers and stopwatches to the user (describe by label and time, NOT by ID)

---

## Workflow: Cancel a timer

Examples: "Cancel the timer" / "Delete the timer"

1. `timer` → `list` → find the timer by label or description
2. `timer` → `cancel` with the found `timer_id`
3. Confirm: "Timer cancelled"

---

## Examples

### "Egg timer 20 seconds"

1. Calculate: 20 seconds = 20000 ms
2. `timer` → `start_timer` with `duration_ms: 20000, label: "egg timer"`
3. Confirm: "Timer started: 20 seconds"

### "Set a timer for 3 minutes"

1. Calculate: 3 minutes = 180000 ms
2. `timer` → `start_timer` with `duration_ms: 180000`
3. Confirm: "Timer started: 3 minutes"

### "Start stopwatch for running"

1. `timer` → `start_stopwatch` with `label: "Running"`
2. Confirm: "Stopwatch started: Running"

### "How long has the stopwatch been running?"

1. `timer` → `list` → find stopwatch with label "Running"
2. `timer` → `get_status` with the found timer_id
3. Report: "The stopwatch has been running for 5 minutes and 23 seconds"

### "Stop the running stopwatch"

1. `timer` → `list` → find stopwatch with label "Running"
2. `timer` → `stop` with the found timer_id
3. Confirm: "Stopwatch stopped: 5 minutes 23 seconds"

### "What timers are running?"

1. `timer` → `list`
2. Report all timers: "You have 2 active timers: a 3-minute timer and a running stopwatch"

---

## Important rules

- **ALWAYS use timer tool for short durations**: When the user asks for a timer (especially "egg timer" or durations in seconds), use the `timer` tool, NOT the `scheduler` tool. The scheduler requires a minimum of 1 minute and is for complex tasks.
- **Time calculations**: Use `device` tool with `get_time` action to get the current time (`now_ms`) for any time-related calculations. Do NOT calculate timestamps manually.
- **Timer IDs are internal**: Never show timer IDs to the user. Describe timers by their label and time.
- **Auto-removal**: Timers are automatically removed when they expire. Stopwatches are removed when stopped.
- **Multiple timers**: Multiple timers and stopwatches can run in parallel.
- **Duration format**: Always use milliseconds for `duration_ms` (e.g. 20 seconds = 20000, 1 minute = 60000, 3 minutes = 180000).
- **Stop vs Cancel**: Use `stop` only for stopwatches (returns elapsed time). Use `cancel` for any timer/stopwatch (just removes it).

---
name: google-tasks
description: Read, create and manage tasks via the Google Tasks API
test_prompt: Fetch the task lists and show the open tasks from the first list
permissions:
 - android.permission.INTERNET
credentials:
 - id: google_credentials
   label: Google Account
   type: oauth
   auth_provider: google
---
# Google Tasks Skill

Manage tasks (to-dos) via the Google Tasks API.

## Tool: http

All requests require `auth_provider: "google"`.

Base URL: `https://tasks.googleapis.com/tasks/v1`

### Fetch task lists

```json
{
  "method": "GET",
  "url": "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
  "auth_provider": "google"
}
```

Result contains `items[]` with `id` and `title`. The default list is usually named "My Tasks".

### Fetch tasks from a list

```json
{
  "method": "GET",
  "url": "https://tasks.googleapis.com/tasks/v1/lists/{TASKLIST_ID}/tasks?showCompleted=false&maxResults=20",
  "auth_provider": "google"
}
```

Parameters:
- `showCompleted=true/false` – Show completed tasks
- `showHidden=true` – Show deleted/hidden tasks
- `dueMin` / `dueMax` – Filter by due date (RFC 3339, e.g. `2024-01-15T00:00:00Z`)

### Create a new task

```json
{
  "method": "POST",
  "url": "https://tasks.googleapis.com/tasks/v1/lists/{TASKLIST_ID}/tasks",
  "auth_provider": "google",
  "body": {
    "title": "{TITLE}",
    "notes": "{NOTES}",
    "due": "{ISO_DATE}T00:00:00.000Z"
  }
}
```

Fields:
- `title` (required) – Task title
- `notes` (optional) – Additional notes/description
- `due` (optional) – Due date as RFC 3339 timestamp

### Update a task

```json
{
  "method": "PATCH",
  "url": "https://tasks.googleapis.com/tasks/v1/lists/{TASKLIST_ID}/tasks/{TASK_ID}",
  "auth_provider": "google",
  "body": {
    "title": "{NEW_TITLE}",
    "notes": "{NEW_NOTES}",
    "due": "{ISO_DATE}T00:00:00.000Z"
  }
}
```

### Mark a task as completed

```json
{
  "method": "PATCH",
  "url": "https://tasks.googleapis.com/tasks/v1/lists/{TASKLIST_ID}/tasks/{TASK_ID}",
  "auth_provider": "google",
  "body": {
    "status": "completed"
  }
}
```

Status values: `"needsAction"` (open), `"completed"` (done)

### Delete a task

```json
{
  "method": "DELETE",
  "url": "https://tasks.googleapis.com/tasks/v1/lists/{TASKLIST_ID}/tasks/{TASK_ID}",
  "auth_provider": "google"
}
```

## Workflow: Read tasks aloud

1. Fetch task lists → select default list (first one)
2. Fetch tasks for the list (showCompleted=false)
3. Read aloud with `tts`: "You have 3 open tasks: 1. Groceries, 2. ..."

## Workflow: Add a task

1. Fetch task lists → select default list
2. POST new task with title (and optionally due date)
3. Confirm with `tts`: "Task created: {TITLE}"

## Workflow: Complete a task

1. Fetch tasks
2. Find matching task by title
3. PATCH with `status: "completed"`
4. Confirm with `tts`: "Task completed: {TITLE}"

## Due dates

Current time: Use `device` tool with `get_time` to get the current time and ISO date (YYYY-MM-DD), then calculate.

### Setting due dates
- "by tomorrow" → tomorrow's date + T00:00:00.000Z
- "by Friday" → calculate next Friday + T00:00:00.000Z
- Format always: `YYYY-MM-DDT00:00:00.000Z`

### Interpreting due dates (IMPORTANT)
When reading tasks aloud and expressing the due date relatively:
1. Get today's ISO date via `device` → `get_time` (field "ISO-Date", format YYYY-MM-DD)
2. Compare ONLY the date part (YYYY-MM-DD) of the `due` field with today's ISO date
3. Calculation: `due` date (YYYY-MM-DD) minus today (YYYY-MM-DD) = days until due

Example: Today is 2026-02-22, task has `due: "2026-02-23T00:00:00.000Z"`
→ 2026-02-23 minus 2026-02-22 = **1 day** → "tomorrow"

Mapping:
- 0 days → "today"
- 1 day → "tomorrow"
- 2 days → "day after tomorrow"
- negative → "overdue"

## Examples

- "What do I still need to do?" → Fetch open tasks + TTS
- "Create a task: Groceries" → POST new task
- "Remind me about the dentist tomorrow" → POST task with tomorrow's due date
- "Do I have tasks for today?" → Fetch tasks, filter by due date
- "Task Groceries is done" → Find task + PATCH completed
- "Delete the dentist task" → Find task + DELETE

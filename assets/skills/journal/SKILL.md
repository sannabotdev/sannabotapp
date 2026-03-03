---
name: journal
category: productivity
description: Create and manage local journal entries to track activities and notes. Tools: journal.
---
# Journal Skill

Create and manage journal entries to track activities, events, and notes. Each entry has a creation timestamp, optional date range, category, title, and details.

## Tool: journal

All journal operations use the `journal` tool.

**Data format:** Each entry contains:
- Creation timestamp (automatic)
- Optional date from / date to (Unix timestamps in milliseconds)
- Category (text)
- Title/heading
- Details/description

---

## Workflow: Create a journal entry

Examples: "Make an entry in the journal that I went jogging today" / "Journal entry: I finished the project"

1. `journal` → `create` with:
   - `title`: A short heading (e.g. "Jogging", "Project completed")
   - `category`: A category name (e.g. "Exercise", "Work", "Personal")
   - `details`: The full description
   - `date_from` (optional): Start date as Unix timestamp in milliseconds
   - `date_to` (optional): End date as Unix timestamp in milliseconds
2. Confirm: "Journal entry created: {title}"

**Important:** When the user mentions a date or time, use the `datetime` tool to calculate the Unix timestamp (milliseconds). Do NOT calculate dates manually.

**For date calculations:**
- Use `datetime` tool with `action: "now"` to get current time (Unix timestamp in milliseconds)
- Use `datetime` tool with `action: "absolute"` for absolute dates:
  - `base`: Enum value (`"today"`, `"tomorrow"`, `"yesterday"`, `"next_monday"`–`"next_sunday"`, `"next_january"`–`"next_december"`), Unix timestamp in milliseconds (number), or ISO date/datetime string (e.g. `"2024-03-15"`, `"2024-03-15T14:00:00"`)
  - `time` (optional): `"HH:MM"` or `"HH:MM:SS"` format (e.g. `"09:00"`)
  - `anchor` (optional): `"beginofday"`, `"endofday"`, `"beginofweek"`, `"endofweek"`, `"beginofmonth"`, `"endofmonth"`
  - `output_unit`: `"milliseconds"` (required for journal entries)
- Use `datetime` tool with `action: "add"` or `action: "subtract"` for relative dates (base can also be ISO string or timestamp)

**Examples:**
- "today" → `datetime absolute` with `base: "today"`, `output_unit: "milliseconds"`
- "yesterday" → `datetime absolute` with `base: "yesterday"`, `output_unit: "milliseconds"`
- "last week" → Calculate date range using `datetime subtract` with `base: "today"`, `amount: 7`, `unit: "day"` for start, and `datetime absolute` with `base: "today"` for end
- "from Monday to Friday" → Use `datetime absolute` with `base: "next_monday"` and `base: "next_friday"` for both dates

---

## Workflow: List all journal entries

Examples: "Show me my journal entries" / "What's in my journal?"

1. `journal` → `list`
2. Display all entries sorted by creation time (newest first)
3. Format: "[ID] Date | Category | Title"

---

## Workflow: List entries by category

Examples: "Show me journal entries in category Work" / "What journal entries are in the Exercise category?"

1. `journal` → `list_by_category` with `category: "{category_name}"`
2. Display filtered entries sorted by creation time (newest first)

---

## Workflow: Get a specific entry

Examples: "Show me journal entry {id}" / "What's in journal entry {id}?"

1. `journal` → `get` with `entry_id: "{id}"`
2. Display full entry details

---

## Workflow: Delete an entry

Examples: "Delete journal entry {id}" / "Remove journal entry {id}"

1. `journal` → `delete` with `entry_id: "{id}"`
2. Confirm: "Journal entry deleted"

---

## Examples

- "Make an entry in the journal that I went jogging today" → create entry with category "Exercise" or "Personal", title "Jogging", details "I went jogging today"
- "Journal entry: I finished the project" → create entry with appropriate category and title
- "Show me my journal entries" → list all entries
- "What journal entries are in the Work category?" → list by category
- "Delete journal entry {id}" → delete entry

---

## Category suggestions

Common categories users might use:
- "Work" – Work-related activities
- "Personal" – Personal activities
- "Exercise" – Physical activities
- "Health" – Health-related events
- "Travel" – Travel and trips
- "Notifications" – Automatically created by notification sub-agents
- "Scheduler" – Automatically created by scheduler sub-agents

The category is free-form text, so users can use any category name they prefer.

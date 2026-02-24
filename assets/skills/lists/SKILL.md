---
name: lists
description: Manage local lists (shopping list, to-do, etc.) – add, remove, read and check items
---
# Lists Skill

Manages simple text lists stored locally on the device – no internet, no cloud.

## Tool: file_storage

All list operations use the `file_storage` tool.

**Data format:** One list = one file. Each item is stored on its own line.

**File names:** Lowercase list name, e.g. `shoppinglist`, `todo`, `packlist`.

---

## Workflow: Add an item

Examples: "Add milk to the shopping list" / "Put milk on the shopping list"

1. `file_storage` → `read` with `filename: "shoppinglist"` → read existing items
2. Check whether the item is already present (if yes: tell the user, do nothing)
3. Append the new item at the end
4. `file_storage` → `write` with the updated content (all lines, one item per line)
5. Confirm: "Milk has been added to the shopping list."

---

## Workflow: Remove an item

Examples: "Remove milk from the shopping list" / "Delete milk from the shopping list"

1. `file_storage` → `read` with `filename: "shoppinglist"`
2. File does not exist → "The shopping list is empty or does not exist."
3. Remove matching line(s) (case-insensitive, partial match allowed)
4. `file_storage` → `write` with the cleaned content
5. Confirm: "Milk has been removed from the shopping list."
6. No match found → "Milk is not on the shopping list."

---

## Workflow: Read / show a list

Examples: "What's on the shopping list?" / "Show me my shopping list"

1. `file_storage` → `read` with `filename: "shoppinglist"`
2. File empty or missing → "The shopping list is empty."
3. Enumerate items: "Your shopping list contains: milk, bread, eggs."

---

## Workflow: List all lists

Examples: "Which lists do I have?" / "What lists are there?"

1. `file_storage` → `list` (no `filename` needed)
2. No files → "You have no lists saved yet."
3. List the names: "You have the following lists: shoppinglist, todo, packlist."

---

## Workflow: Check whether an item is on a list

Examples: "Is milk already on the shopping list?" / "Is bread on the list?"

1. `file_storage` → `read` with `filename: "shoppinglist"`
2. Search for the item (case-insensitive)
3. Found → "Yes, milk is already on the shopping list."
4. Not found → "No, milk is not on the shopping list yet."

---

## Workflow: Delete an entire list

Examples: "Delete the shopping list" / "Clear the shopping list"

1. `file_storage` → `delete` with `filename: "shoppinglist"`
2. Confirm: "The shopping list has been deleted."

---

## Examples

- "Add milk to the shopping list" → add item
- "Add bread and butter to the shopping list" → add multiple items in one go (one `read`, then one `write` with all new items appended)
- "What's on the shopping list?" → read list
- "Remove milk from the shopping list" → remove item
- "Is milk already on the shopping list?" → check item
- "Which lists do I have?" → list all lists
- "Create a packing list" → create new empty file (write with empty content)
- "Delete the shopping list" → delete file

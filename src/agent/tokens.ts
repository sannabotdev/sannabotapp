/**
 * Shared tokens used across agent pipelines.
 *
 * SILENT_REPLY_TOKEN – When a sub-agent (notification, scheduler) determines
 * that its result does not need to be shown to the user, it returns this token
 * instead of a natural-language response. The headless task then silently
 * completes without writing to the pending queue or bringing the app to the
 * foreground.
 *
 * Examples:
 *   - A conditional scheduled task where the condition is false
 *   - A notification rule was executed but the result is purely internal
 */
export const SILENT_REPLY_TOKEN = '__SILENT__';

/** Token returned by the notification sub-agent when no rule condition matches. */
export const NO_MATCH_TOKEN = '__NO_MATCH__';

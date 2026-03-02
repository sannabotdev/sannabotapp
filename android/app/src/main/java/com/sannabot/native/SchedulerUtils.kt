package com.sannabot.native

import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Shared utility functions for schedule recurrence calculations.
 * Used by both SchedulerModule and BootReceiver to avoid code duplication.
 */
object SchedulerUtils {
    /**
     * Calculate the next future trigger time for a recurring schedule.
     * Mirrors the logic in scheduler-tool.ts calculateNextTrigger().
     * Returns null for one-time ('once') schedules.
     */
    fun calculateNextTrigger(schedule: JSONObject, now: Long): Long? {
        val recurrence = schedule.optJSONObject("recurrence") ?: return null
        val type = recurrence.optString("type", "once")

        return when (type) {
            "once" -> null

            "interval" -> {
                val intervalMs = recurrence.optLong("intervalMs", 60_000)
                now + intervalMs
            }

            "daily" -> {
                val time = recurrence.optString("time", "") ?: ""
                if (time.isEmpty()) return null
                getNextDailyTrigger(time, now)
            }

            "weekly" -> {
                val time = recurrence.optString("time", "") ?: ""
                val daysArray = recurrence.optJSONArray("daysOfWeek")
                if (time.isEmpty() || daysArray == null || daysArray.length() == 0) return null
                val days = (0 until daysArray.length()).map { daysArray.getInt(it) }
                getNextWeeklyTrigger(time, days, now)
            }

            else -> null
        }
    }

    /**
     * Get the next occurrence of a daily time (HH:mm) after [after] timestamp.
     */
    fun getNextDailyTrigger(time: String, after: Long): Long {
        val parts = time.split(":")
        val hours = parts[0].toInt()
        val minutes = parts[1].toInt()

        val cal = Calendar.getInstance().apply {
            timeInMillis = after
            set(Calendar.HOUR_OF_DAY, hours)
            set(Calendar.MINUTE, minutes)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        // If this time today has already passed, schedule for tomorrow
        if (cal.timeInMillis <= after) {
            cal.add(Calendar.DAY_OF_MONTH, 1)
        }

        return cal.timeInMillis
    }

    /**
     * Get the next occurrence of a weekly schedule after [after] timestamp.
     * daysOfWeek: 1=Mon, 2=Tue, ..., 7=Sun
     */
    fun getNextWeeklyTrigger(time: String, daysOfWeek: List<Int>, after: Long): Long {
        val parts = time.split(":")
        val hours = parts[0].toInt()
        val minutes = parts[1].toInt()

        for (daysAhead in 0..7) {
            val cal = Calendar.getInstance().apply {
                timeInMillis = after
                add(Calendar.DAY_OF_MONTH, daysAhead)
                set(Calendar.HOUR_OF_DAY, hours)
                set(Calendar.MINUTE, minutes)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            // Calendar.DAY_OF_WEEK: 1=Sun, 2=Mon, ..., 7=Sat
            // Convert to our format: 1=Mon, ..., 7=Sun
            val calDay = cal.get(Calendar.DAY_OF_WEEK)
            val ourDay = if (calDay == Calendar.SUNDAY) 7 else calDay - 1

            if (daysOfWeek.contains(ourDay) && cal.timeInMillis > after) {
                return cal.timeInMillis
            }
        }

        // Fallback: 7 days from now
        return after + 7 * 24 * 60 * 60 * 1000
    }
}

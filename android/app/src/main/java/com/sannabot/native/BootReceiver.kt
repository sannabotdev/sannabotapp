package com.sannabot.native

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * BootReceiver – Re-schedules all enabled alarms after device reboot or app update.
 *
 * Android cancels all AlarmManager alarms on reboot.
 * This receiver reads persisted schedules and re-registers future alarms.
 * For recurring schedules whose trigger time has already passed, it calculates
 * the next future trigger instead of silently dropping them.
 *
 * Also handles MY_PACKAGE_REPLACED as a safety net for app updates.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        Log.d(TAG, "$action – re-scheduling alarms")

        val prefs = context.getSharedPreferences(
            SchedulerModule.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        val json = prefs.getString(SchedulerModule.PREFS_SCHEDULES_KEY, "[]") ?: "[]"
        val schedules = JSONArray(json)
        val now = System.currentTimeMillis()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var schedulesUpdated = false

        for (i in 0 until schedules.length()) {
            val schedule = schedules.getJSONObject(i)
            val id = schedule.getString("id")
            val enabled = schedule.optBoolean("enabled", true)
            var triggerAt = schedule.optLong("triggerAtMs", 0)

            if (!enabled) {
                Log.d(TAG, "Skipping disabled schedule: $id")
                continue
            }

            // If trigger is in the past, try to advance recurring schedules
            if (triggerAt <= now) {
                val nextTrigger = calculateNextTrigger(schedule, now)
                if (nextTrigger == null) {
                    Log.d(TAG, "Skipping expired one-time schedule: $id")
                    continue
                }
                // Update the trigger time in the JSON array for persistence
                triggerAt = nextTrigger
                schedule.put("triggerAtMs", triggerAt)
                schedulesUpdated = true
                Log.d(TAG, "Advanced recurring schedule $id to ${java.util.Date(triggerAt)}")
            }

            // Register the alarm
            val alarmIntent = Intent(context, SchedulerReceiver::class.java).apply {
                this.action = "com.sannabot.SCHEDULED_TASK"
                putExtra("schedule_id", id)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAt,
                pendingIntent
            )
            Log.d(TAG, "Re-scheduled: $id at ${java.util.Date(triggerAt)}")
        }

        // Persist updated trigger times back to SharedPreferences
        if (schedulesUpdated) {
            prefs.edit()
                .putString(SchedulerModule.PREFS_SCHEDULES_KEY, schedules.toString())
                .apply()
            Log.d(TAG, "Persisted updated trigger times to SharedPreferences")
        }
    }

    /**
     * Calculate the next future trigger time for a recurring schedule.
     * Mirrors the logic in scheduler-tool.ts calculateNextTrigger().
     * Returns null for one-time ('once') schedules.
     */
    private fun calculateNextTrigger(schedule: JSONObject, now: Long): Long? {
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
    private fun getNextDailyTrigger(time: String, after: Long): Long {
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
    private fun getNextWeeklyTrigger(time: String, daysOfWeek: List<Int>, after: Long): Long {
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

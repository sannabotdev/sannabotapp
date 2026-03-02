package com.sannabot.native

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

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
                val nextTrigger = SchedulerUtils.calculateNextTrigger(schedule, now)
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
}

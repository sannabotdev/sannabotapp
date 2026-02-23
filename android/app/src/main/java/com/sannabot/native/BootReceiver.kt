package com.sannabot.native

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONArray

/**
 * BootReceiver – Re-schedules all enabled alarms after device reboot.
 *
 * Android cancels all AlarmManager alarms on reboot.
 * This receiver reads persisted schedules and re-registers future alarms.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Log.d(TAG, "Boot completed – re-scheduling alarms")

        val prefs = context.getSharedPreferences(
            SchedulerModule.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        val json = prefs.getString(SchedulerModule.PREFS_SCHEDULES_KEY, "[]") ?: "[]"
        val schedules = JSONArray(json)
        val now = System.currentTimeMillis()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        for (i in 0 until schedules.length()) {
            val schedule = schedules.getJSONObject(i)
            val id = schedule.getString("id")
            val enabled = schedule.optBoolean("enabled", true)
            val triggerAt = schedule.optLong("triggerAtMs", 0)

            if (!enabled) {
                Log.d(TAG, "Skipping disabled schedule: $id")
                continue
            }

            if (triggerAt <= now) {
                Log.d(TAG, "Skipping expired schedule: $id")
                continue
            }

            // Re-register the alarm
            val alarmIntent = Intent(context, SchedulerReceiver::class.java).apply {
                action = "com.sannabot.SCHEDULED_TASK"
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
            Log.d(TAG, "Re-scheduled: $id at $triggerAt")
        }
    }
}

package com.sannabot.native

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

/**
 * SchedulerModule – Manages scheduled sub-agent executions.
 *
 * Persists schedules in SharedPreferences and uses AlarmManager for
 * precise background wake-ups. When an alarm fires, SchedulerReceiver
 * starts a HeadlessJS task that spins up a mini ConversationPipeline
 * (sub-agent) to execute the stored instruction.
 *
 * Supports: one-time, interval, daily, weekly recurrence.
 * Full CRUD: create, read, update, delete, enable/disable.
 */
class SchedulerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val PREFS_NAME = "sanna_scheduler"
        const val PREFS_SCHEDULES_KEY = "schedules"
        const val PREFS_AGENT_CONFIG_KEY = "agent_config"
    }

    override fun getName(): String = "SchedulerModule"

    // ── Schedule CRUD ────────────────────────────────────────────────────────

    /**
     * Save a schedule and set/update its alarm.
     * Schedule JSON must contain at least: id, instruction, triggerAtMs, enabled, recurrence.
     */
    @ReactMethod
    fun setSchedule(scheduleJson: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val schedule = JSONObject(scheduleJson)
            val id = schedule.getString("id")
            val enabled = schedule.optBoolean("enabled", true)
            val triggerAtMs = schedule.optLong("triggerAtMs", 0)

            // Persist the schedule
            saveScheduleToPrefs(context, schedule)

            // Set alarm only if enabled and trigger is in the future
            if (enabled && triggerAtMs > System.currentTimeMillis()) {
                setAlarm(context, id, triggerAtMs)
            } else {
                // Cancel any existing alarm for this schedule
                cancelAlarm(context, id)
            }

            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message ?: "setSchedule fehlgeschlagen", e)
        }
    }

    /**
     * Remove a schedule completely (cancel alarm + delete from storage).
     */
    @ReactMethod
    fun removeSchedule(id: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            cancelAlarm(context, id)
            removeScheduleFromPrefs(context, id)
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("REMOVE_ERROR", e.message ?: "removeSchedule fehlgeschlagen", e)
        }
    }

    /**
     * Get a single schedule by ID.
     * Returns JSON string or null.
     */
    @ReactMethod
    fun getSchedule(id: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val schedule = loadScheduleById(context, id)
            promise.resolve(schedule?.toString())
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message ?: "getSchedule fehlgeschlagen", e)
        }
    }

    /**
     * List all schedules.
     * Returns JSON array string.
     */
    @ReactMethod
    fun getAllSchedules(promise: Promise) {
        try {
            val context = reactApplicationContext
            val schedules = loadAllSchedules(context)
            promise.resolve(schedules.toString())
        } catch (e: Exception) {
            promise.reject("LIST_ERROR", e.message ?: "getAllSchedules fehlgeschlagen", e)
        }
    }

    /**
     * Update the next trigger time for a schedule (used after recurring execution).
     * Also re-sets the alarm.
     */
    @ReactMethod
    fun updateTrigger(id: String, newTriggerAtMs: Double, promise: Promise) {
        try {
            val context = reactApplicationContext
            val schedule = loadScheduleById(context, id) ?: run {
                promise.reject("NOT_FOUND", "Schedule $id nicht gefunden")
                return
            }
            schedule.put("triggerAtMs", newTriggerAtMs.toLong())
            saveScheduleToPrefs(context, schedule)

            if (schedule.optBoolean("enabled", true) && newTriggerAtMs.toLong() > System.currentTimeMillis()) {
                setAlarm(context, id, newTriggerAtMs.toLong())
            }
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message ?: "updateTrigger fehlgeschlagen", e)
        }
    }

    /**
     * Record last execution time on a schedule.
     */
    @ReactMethod
    fun markExecuted(id: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val schedule = loadScheduleById(context, id) ?: run {
                promise.reject("NOT_FOUND", "Schedule $id nicht gefunden")
                return
            }
            schedule.put("lastExecutedAt", System.currentTimeMillis())
            saveScheduleToPrefs(context, schedule)
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message ?: "markExecuted fehlgeschlagen", e)
        }
    }

    // ── Agent Config (for HeadlessJS sub-agent) ──────────────────────────────

    /**
     * Save agent config so the headless sub-agent can create a pipeline.
     * Config: { apiKey, provider, model, enabledSkillNames }
     */
    @ReactMethod
    fun saveAgentConfig(configJson: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(PREFS_AGENT_CONFIG_KEY, configJson).apply()
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("CONFIG_ERROR", e.message ?: "saveAgentConfig fehlgeschlagen", e)
        }
    }

    /**
     * Get saved agent config.
     */
    @ReactMethod
    fun getAgentConfig(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val config = prefs.getString(PREFS_AGENT_CONFIG_KEY, null)
            promise.resolve(config)
        } catch (e: Exception) {
            promise.reject("CONFIG_ERROR", e.message ?: "getAgentConfig fehlgeschlagen", e)
        }
    }

    // ── AlarmManager helpers ─────────────────────────────────────────────────

    private fun setAlarm(context: Context, id: String, triggerAtMs: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Check exact alarm permission on Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                throw IllegalStateException(
                    "Exakte Alarme nicht erlaubt. Bitte in den Android-Einstellungen aktivieren."
                )
            }
        }

        val intent = Intent(context, SchedulerReceiver::class.java).apply {
            action = "com.sannabot.SCHEDULED_TASK"
            putExtra("schedule_id", id)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAtMs,
            pendingIntent
        )
    }

    private fun cancelAlarm(context: Context, id: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, SchedulerReceiver::class.java).apply {
            action = "com.sannabot.SCHEDULED_TASK"
            putExtra("schedule_id", id)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }

    // ── SharedPreferences helpers ────────────────────────────────────────────

    private fun saveScheduleToPrefs(context: Context, schedule: JSONObject) {
        val schedules = loadAllSchedules(context)
        val id = schedule.getString("id")

        // Replace existing or add new
        val updated = JSONArray()
        var found = false
        for (i in 0 until schedules.length()) {
            val existing = schedules.getJSONObject(i)
            if (existing.getString("id") == id) {
                updated.put(schedule)
                found = true
            } else {
                updated.put(existing)
            }
        }
        if (!found) {
            updated.put(schedule)
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PREFS_SCHEDULES_KEY, updated.toString()).apply()
    }

    private fun removeScheduleFromPrefs(context: Context, id: String) {
        val schedules = loadAllSchedules(context)
        val updated = JSONArray()
        for (i in 0 until schedules.length()) {
            val schedule = schedules.getJSONObject(i)
            if (schedule.getString("id") != id) {
                updated.put(schedule)
            }
        }
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PREFS_SCHEDULES_KEY, updated.toString()).apply()
    }

    private fun loadScheduleById(context: Context, id: String): JSONObject? {
        val schedules = loadAllSchedules(context)
        for (i in 0 until schedules.length()) {
            val schedule = schedules.getJSONObject(i)
            if (schedule.getString("id") == id) {
                return schedule
            }
        }
        return null
    }

    private fun loadAllSchedules(context: Context): JSONArray {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(PREFS_SCHEDULES_KEY, "[]") ?: "[]"
        return JSONArray(json)
    }
}

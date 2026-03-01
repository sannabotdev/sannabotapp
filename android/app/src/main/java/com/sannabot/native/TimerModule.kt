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
 * TimerModule – Manages countdown timers and stopwatches.
 *
 * Persists timers in SharedPreferences and uses AlarmManager for
 * precise countdown timer expiration. When a timer expires, TimerReceiver
 * plays a beep and removes the timer.
 *
 * Supports: countdown timers (with beep on expiration) and stopwatches (elapsed time tracking).
 * Full CRUD: create, read, update, delete.
 */
class TimerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val PREFS_NAME = "sanna_timers"
        const val PREFS_TIMERS_KEY = "timers"
    }

    override fun getName(): String = "TimerModule"

    // ── Timer CRUD ────────────────────────────────────────────────────────────

    /**
     * Save a timer and set/update its alarm (for countdown timers).
     * Timer JSON must contain at least: id, type, startTimeMs, enabled.
     * For type='timer', durationMs is required.
     */
    @ReactMethod
    fun setTimer(timerJson: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val timer = JSONObject(timerJson)
            val id = timer.getString("id")
            val type = timer.getString("type")
            val enabled = timer.optBoolean("enabled", true)

            // Persist the timer
            saveTimerToPrefs(context, timer)

            // Set alarm only for countdown timers that are enabled
            if (type == "timer" && enabled) {
                val durationMs = timer.optLong("durationMs", 0)
                val startTimeMs = timer.optLong("startTimeMs", 0)
                if (durationMs > 0 && startTimeMs > 0) {
                    val triggerAtMs = startTimeMs + durationMs
                    // Only set alarm if trigger time is in the future
                    if (triggerAtMs > System.currentTimeMillis()) {
                        setAlarm(context, id, triggerAtMs)
                    } else {
                        // Timer already expired, cancel any existing alarm
                        cancelAlarm(context, id)
                    }
                }
            } else {
                // Stopwatch or disabled timer - cancel any existing alarm
                cancelAlarm(context, id)
            }

            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("TIMER_ERROR", e.message ?: "setTimer failed", e)
        }
    }

    /**
     * Remove a timer completely (cancel alarm + delete from storage).
     */
    @ReactMethod
    fun removeTimer(id: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            cancelAlarm(context, id)
            removeTimerFromPrefs(context, id)
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("REMOVE_ERROR", e.message ?: "removeTimer failed", e)
        }
    }

    /**
     * Get a single timer by ID.
     * Returns JSON string or null.
     */
    @ReactMethod
    fun getTimer(id: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val timer = loadTimerById(context, id)
            promise.resolve(timer?.toString())
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message ?: "getTimer failed", e)
        }
    }

    /**
     * List all timers.
     * Returns JSON array string.
     */
    @ReactMethod
    fun getAllTimers(promise: Promise) {
        try {
            val context = reactApplicationContext
            val timers = loadAllTimers(context)
            promise.resolve(timers.toString())
        } catch (e: Exception) {
            promise.reject("LIST_ERROR", e.message ?: "getAllTimers failed", e)
        }
    }

    /**
     * Get elapsed time for a stopwatch in milliseconds.
     * Returns 0 if timer not found or not a stopwatch.
     */
    @ReactMethod
    fun getElapsedTime(id: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val timer = loadTimerById(context, id)
            if (timer == null || timer.getString("type") != "stopwatch") {
                promise.resolve(0)
                return
            }
            val startTimeMs = timer.optLong("startTimeMs", 0)
            val now = System.currentTimeMillis()
            val elapsed = now - startTimeMs
            promise.resolve(elapsed)
        } catch (e: Exception) {
            promise.reject("ELAPSED_ERROR", e.message ?: "getElapsedTime failed", e)
        }
    }


    // ── AlarmManager helpers ───────────────────────────────────────────────────

    private fun setAlarm(context: Context, id: String, triggerAtMs: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Check exact alarm permission on Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                android.util.Log.w("TimerModule", "Exact alarms not allowed. Timer may not fire accurately.")
            }
        }

        val intent = Intent(context, TimerReceiver::class.java).apply {
            action = "com.sannabot.TIMER_EXPIRED"
            putExtra("timer_id", id)
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
        val intent = Intent(context, TimerReceiver::class.java).apply {
            action = "com.sannabot.TIMER_EXPIRED"
            putExtra("timer_id", id)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }

    // ── SharedPreferences helpers ─────────────────────────────────────────────

    private fun saveTimerToPrefs(context: Context, timer: JSONObject) {
        val timers = loadAllTimers(context)
        val id = timer.getString("id")

        // Replace existing or add new
        val updated = JSONArray()
        var found = false
        for (i in 0 until timers.length()) {
            val existing = timers.getJSONObject(i)
            if (existing.getString("id") == id) {
                updated.put(timer)
                found = true
            } else {
                updated.put(existing)
            }
        }
        if (!found) {
            updated.put(timer)
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PREFS_TIMERS_KEY, updated.toString()).apply()
    }

    private fun removeTimerFromPrefs(context: Context, id: String) {
        val timers = loadAllTimers(context)
        val updated = JSONArray()
        for (i in 0 until timers.length()) {
            val timer = timers.getJSONObject(i)
            if (timer.getString("id") != id) {
                updated.put(timer)
            }
        }
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PREFS_TIMERS_KEY, updated.toString()).apply()
    }

    private fun loadTimerById(context: Context, id: String): JSONObject? {
        val timers = loadAllTimers(context)
        for (i in 0 until timers.length()) {
            val timer = timers.getJSONObject(i)
            if (timer.getString("id") == id) {
                return timer
            }
        }
        return null
    }

    private fun loadAllTimers(context: Context): JSONArray {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(PREFS_TIMERS_KEY, "[]") ?: "[]"
        return JSONArray(json)
    }
}

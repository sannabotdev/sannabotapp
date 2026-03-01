package com.sannabot.native

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import kotlinx.coroutines.*
import org.json.JSONArray

/**
 * TimerReceiver – Receives AlarmManager broadcasts when a countdown timer expires.
 *
 * When a timer expires, this receiver:
 * 1. Plays a beep using ToneGenerator
 * 2. Starts a HeadlessJS task to format a user-friendly message via LLM
 * 3. Removes the timer from SharedPreferences (prevents list from growing)
 */
class TimerReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "TimerReceiver"
        private const val PREFS_NAME = "sanna_timers"
        private const val PREFS_TIMERS_KEY = "timers"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val timerId = intent.getStringExtra("timer_id") ?: return
        Log.d(TAG, "Timer expired: $timerId")

        // Play beep
        playBeep(context)

        // Start HeadlessJS task to format message via LLM
        val serviceIntent = Intent(context, TimerHeadlessService::class.java).apply {
            putExtras(Bundle().apply {
                putString("timerId", timerId)
            })
        }

        try {
            context.startService(serviceIntent)
            HeadlessJsTaskService.acquireWakeLockNow(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start headless service: ${e.message}", e)
            // If headless service fails, remove timer manually
            removeTimerFromPrefs(context, timerId)
        }
        // Note: Timer is removed by the headless task after formatting the message
    }

    /**
     * Play an alarm tone using ToneGenerator (same approach as TTSModule.playBeep).
     * Uses TONE_CDMA_ALERT_CALL_GUARD (79) for alarm-like tone, same as BeepTool with tone="alarm".
     */
    private fun playBeep(context: Context) {
        CoroutineScope(Dispatchers.IO).launch {
            var generator: ToneGenerator? = null
            try {
                generator = ToneGenerator(AudioManager.STREAM_ALARM, 100)
                // Play 3 alarm tones with 300ms pause between (more urgent than default beep)
                val toneType = ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD // 79 - alarm tone
                val duration = 500
                val count = 3
                val pauseMs = 300L

                for (i in 0 until count) {
                    generator.startTone(toneType, duration)
                    delay(duration.toLong())
                    if (i < count - 1) {
                        delay(pauseMs)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to play alarm: ${e.message}", e)
            } finally {
                generator?.release()
            }
        }
    }


    /**
     * Remove timer from SharedPreferences.
     */
    private fun removeTimerFromPrefs(context: Context, id: String) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(PREFS_TIMERS_KEY, "[]") ?: "[]"
            val timers = JSONArray(json)
            val updated = JSONArray()

            for (i in 0 until timers.length()) {
                val timer = timers.getJSONObject(i)
                if (timer.getString("id") != id) {
                    updated.put(timer)
                }
            }

            prefs.edit().putString(PREFS_TIMERS_KEY, updated.toString()).apply()
            Log.d(TAG, "Timer $id removed from storage")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove timer from storage: ${e.message}", e)
        }
    }
}

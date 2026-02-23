package com.sannabot.native

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

/**
 * SchedulerReceiver – Receives AlarmManager broadcasts and starts
 * the HeadlessJS sub-agent task.
 *
 * When an alarm fires, this receiver creates a HeadlessJS task
 * that runs the stored instruction through a mini ConversationPipeline.
 */
class SchedulerReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SchedulerReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val scheduleId = intent.getStringExtra("schedule_id") ?: return
        Log.d(TAG, "Alarm fired for schedule: $scheduleId")

        // Start the HeadlessJS service with the schedule ID
        val serviceIntent = Intent(context, SchedulerHeadlessService::class.java).apply {
            putExtras(Bundle().apply {
                putString("scheduleId", scheduleId)
            })
        }

        try {
            context.startService(serviceIntent)
            HeadlessJsTaskService.acquireWakeLockNow(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start headless service: ${e.message}", e)
        }
    }
}

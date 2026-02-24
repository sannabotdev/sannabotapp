package com.sannabot.native

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * AccessibilityHeadlessService – Runs the LLM sub-agent for UI automation.
 *
 * Promotes itself to a foreground service so Android does not kill the process
 * while another app (e.g. WhatsApp) is in the foreground.
 *
 * NOTE: The JS thread stays responsive because the main pipeline's LLM call +
 * TTS keep it busy while the sub-agent runs. No WakeLock needed.
 *
 * Intent extra: "jobJson" – JSON with { packageName, goal, intentAction?, intentUri? }
 */
class AccessibilityHeadlessService : HeadlessJsTaskService() {

    companion object {
        private const val CHANNEL_ID      = "sanna_accessibility_bg"
        private const val NOTIFICATION_ID = 9003
        const val TASK_NAME               = "SannaAccessibilityTask"
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Promote to foreground service → prevents process kill
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        return super.onStartCommand(intent, flags, startId)
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val jobJson = intent?.getStringExtra("jobJson") ?: return null
        val data = Arguments.createMap().apply { putString("jobJson", jobJson) }
        return HeadlessJsTaskConfig(
            TASK_NAME,
            data,
            300_000, // 5-minute timeout
            true     // allow running when app is in foreground too
        )
    }

    // ── Notification helpers ──────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Sanna UI Automation", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Shown while Sanna controls another app" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION") Notification.Builder(this)
        }
        return builder
            .setContentTitle("Sanna")
            .setContentText("UI automation running…")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()
    }
}

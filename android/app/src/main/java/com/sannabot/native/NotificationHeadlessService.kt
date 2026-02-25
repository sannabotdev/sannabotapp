package com.sannabot.native

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * NotificationHeadlessService – Runs the JS notification sub-agent in the background.
 *
 * Started directly by SannaNotificationListenerService when a matching notification
 * arrives (bypasses React Native's event system entirely).
 *
 * Dispatches the 'SannaNotificationTask' headless task with the notification
 * data serialised as a JSON string in the "notificationJson" extra.
 */
class NotificationHeadlessService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val notificationJson = intent?.getStringExtra("notificationJson") ?: return null

        val data = Arguments.createMap().apply {
            putString("notificationJson", notificationJson)
        }

        return HeadlessJsTaskConfig(
            "SannaNotificationTask",  // Must match AppRegistry.registerHeadlessTask name
            data,
            120_000,                  // Timeout: 2 minutes for sub-agent execution
            true                      // Allow task in foreground too
        )
    }
}

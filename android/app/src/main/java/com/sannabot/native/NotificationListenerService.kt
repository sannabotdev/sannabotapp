package com.sannabot.native

import android.content.Context
import android.content.SharedPreferences
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray

/**
 * NotificationListenerService – Captures incoming notifications from all apps
 *
 * When a notification arrives from a subscribed app (package name in allowlist),
 * extracts the notification data and emits it to React Native via DeviceEventEmitter.
 *
 * Requires the user to grant "Notification Access" permission in Android Settings.
 */
class SannaNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "NotificationListener"
        private const val PREFS_NAME = "sanna_notifications"
        private const val PREFS_SUBSCRIBED_APPS_KEY = "subscribed_apps"
        private const val PREFS_NOTIFICATIONS_BUFFER_KEY = "notifications_buffer"
        private const val MAX_BUFFER_SIZE = 50 // Keep last 50 notifications

        /**
         * Get the list of subscribed package names from SharedPreferences.
         */
        fun getSubscribedApps(context: Context): Set<String> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(PREFS_SUBSCRIBED_APPS_KEY, "[]") ?: "[]"
            return try {
                val array = JSONArray(json)
                (0 until array.length()).map { array.getString(it) }.toSet()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse subscribed apps: ${e.message}", e)
                emptySet()
            }
        }

        /**
         * Save a notification to the buffer (for get_recent retrieval).
         */
        fun addToBuffer(context: Context, notification: NotificationData) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(PREFS_NOTIFICATIONS_BUFFER_KEY, "[]") ?: "[]"
            try {
                val array = JSONArray(json)
                // Add new notification at the beginning
                array.put(0, notification.toJSON())
                // Trim to max size
                while (array.length() > MAX_BUFFER_SIZE) {
                    array.remove(array.length() - 1)
                }
                prefs.edit().putString(PREFS_NOTIFICATIONS_BUFFER_KEY, array.toString()).apply()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to add notification to buffer: ${e.message}", e)
            }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        try {
            val packageName = sbn.packageName
            val subscribedApps = getSubscribedApps(this)

            // Only process notifications from subscribed apps
            if (!subscribedApps.contains(packageName)) {
                return
            }

            val notification = sbn.notification
            val extras = notification.extras

            // Extract notification data
            val title = extras?.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString() ?: ""
            val text = extras?.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString() ?: ""
            val subText = extras?.getCharSequence(android.app.Notification.EXTRA_SUB_TEXT)?.toString()
            val summaryText = extras?.getCharSequence(android.app.Notification.EXTRA_SUMMARY_TEXT)?.toString()

            // Try to extract sender/conversation info (for messaging apps)
            val sender = extras?.getString("android.text") ?: 
                        extras?.getCharSequence("android.title.big")?.toString() ?:
                        subText ?: summaryText

            val notificationData = NotificationData(
                packageName = packageName,
                title = title,
                text = text,
                sender = sender ?: "",
                timestamp = sbn.postTime,
                key = sbn.key
            )

            // Save to buffer
            addToBuffer(this, notificationData)

            // Emit to React Native
            emitNotificationEvent(notificationData)
        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification: ${e.message}", e)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Not needed for our use case
    }

    /**
     * Emit notification event to React Native via DeviceEventEmitter.
     * Uses the ReactApplicationContext stored in NotificationListenerModule.
     */
    private fun emitNotificationEvent(data: NotificationData) {
        val reactContext = NotificationListenerModule.getReactContext()
            ?: run {
                Log.w(TAG, "ReactContext not available, notification not emitted")
                return
            }

        val params = Arguments.createMap().apply {
            putString("packageName", data.packageName)
            putString("title", data.title)
            putString("text", data.text)
            putString("sender", data.sender)
            putDouble("timestamp", data.timestamp.toDouble())
            putString("key", data.key)
        }

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onNotification", params)

        Log.d(TAG, "Emitted notification: ${data.packageName} - ${data.title}")
    }

    /**
     * Data class for notification information.
     */
    data class NotificationData(
        val packageName: String,
        val title: String,
        val text: String,
        val sender: String,
        val timestamp: Long,
        val key: String
    ) {
        fun toJSON(): org.json.JSONObject {
            return org.json.JSONObject().apply {
                put("packageName", packageName)
                put("title", title)
                put("text", text)
                put("sender", sender)
                put("timestamp", timestamp)
                put("key", key)
            }
        }

        companion object {
            fun fromJSON(json: org.json.JSONObject): NotificationData {
                return NotificationData(
                    packageName = json.getString("packageName"),
                    title = json.optString("title", ""),
                    text = json.optString("text", ""),
                    sender = json.optString("sender", ""),
                    timestamp = json.getLong("timestamp"),
                    key = json.getString("key")
                )
            }
        }
    }
}

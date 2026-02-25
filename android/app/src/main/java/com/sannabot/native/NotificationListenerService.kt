package com.sannabot.native

import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import org.json.JSONArray

/**
 * NotificationListenerService – Captures incoming notifications and starts the
 * background sub-agent directly.
 *
 * When a notification arrives from a subscribed app, the service serialises the
 * notification data and starts NotificationHeadlessService, which in turn runs
 * the 'SannaNotificationTask' JS headless task.
 *
 * This approach bypasses the React Native DeviceEventEmitter entirely – the
 * notification sub-agent always runs in a dedicated background thread, regardless
 * of whether SannaBot's Activity is in the foreground or not.
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
        private const val MAX_PROCESSED_KEYS = 200

        /**
         * Set of notification keys that have already been processed.
         * Prevents duplicate processing when Android re-posts existing
         * child notifications (e.g. Gmail re-posts all emails when a new one arrives).
         */
        private val processedKeys = LinkedHashSet<String>()

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

            // Skip group summary notifications (e.g. Gmail's "3 new messages").
            // We process the individual child notifications instead, which contain
            // the actual sender + subject per email.
            val isGroupSummary = (notification.flags and android.app.Notification.FLAG_GROUP_SUMMARY) != 0
            if (isGroupSummary) {
                Log.d(TAG, "Skipping group summary from $packageName: ${extras?.getCharSequence(android.app.Notification.EXTRA_TEXT)}")
                return
            }

            // Deduplicate: skip notifications that have already been processed.
            // Android re-posts existing child notifications when a new sibling arrives
            // (e.g. Gmail re-fires all individual emails when a new email comes in).
            if (!processedKeys.add(sbn.key)) {
                Log.d(TAG, "Skipping already-processed notification: ${sbn.key}")
                return
            }
            // Trim oldest entries to prevent unbounded growth
            while (processedKeys.size > MAX_PROCESSED_KEYS) {
                processedKeys.iterator().let { it.next(); it.remove() }
            }

            // Extract notification data
            val title = extras?.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString() ?: ""
            val text = extras?.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString() ?: ""

            // Extract sender depending on app type.
            // Email apps (Gmail, Outlook): EXTRA_TITLE = sender name, EXTRA_SUB_TEXT = account email (receiver!)
            // Messaging apps (WhatsApp, Telegram): EXTRA_TITLE = contact/group name
            val emailPackages = setOf(
                "com.google.android.gm",
                "com.microsoft.office.outlook",
                "com.android.email"
            )

            val sender = if (packageName in emailPackages) {
                // For email: title IS the sender name; do NOT use subText (that's the receiver account)
                title
            } else {
                // For messaging apps: try big title or conversation title, fall back to title
                extras?.getCharSequence("android.title.big")?.toString()
                    ?: extras?.getCharSequence("android.conversationTitle")?.toString()
                    ?: title
            }

            val notificationData = NotificationData(
                packageName = packageName,
                title = title,
                text = text,
                sender = sender,
                timestamp = sbn.postTime,
                key = sbn.key
            )

            // Save to buffer (for get_recent tool access)
            addToBuffer(this, notificationData)

            // Start headless task directly – no dependency on React Native foreground
            startHeadlessTask(notificationData)

        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification: ${e.message}", e)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Not needed for our use case
    }

    /**
     * Serialise notification data and start NotificationHeadlessService.
     * Acquires a wake lock so the device stays awake during JS processing.
     */
    private fun startHeadlessTask(data: NotificationData) {
        try {
            val notificationJson = data.toJSON().toString()
            val serviceIntent = Intent(this, NotificationHeadlessService::class.java).apply {
                putExtra("notificationJson", notificationJson)
            }
            startService(serviceIntent)
            HeadlessJsTaskService.acquireWakeLockNow(this)
            Log.d(TAG, "Started headless task for: ${data.packageName} – \"${data.title}\"")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start headless task: ${e.message}", e)
        }
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

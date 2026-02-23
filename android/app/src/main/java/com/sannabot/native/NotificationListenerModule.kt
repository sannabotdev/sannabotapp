package com.sannabot.native

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.text.TextUtils
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

/**
 * NotificationListenerModule – React Native bridge for notification listener control
 *
 * Provides methods to:
 * - Check if notification access is granted
 * - Open Android's notification access settings
 * - Manage subscribed apps (allowlist)
 * - Retrieve buffered notifications
 */
class NotificationListenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PREFS_NAME = "sanna_notifications"
        private const val PREFS_SUBSCRIBED_APPS_KEY = "subscribed_apps"
        private const val PREFS_NOTIFICATIONS_BUFFER_KEY = "notifications_buffer"
        
        // Store ReactContext for use by NotificationListenerService
        @Volatile
        private var reactContextRef: ReactApplicationContext? = null
        
        fun getReactContext(): ReactApplicationContext? = reactContextRef
    }
    
    init {
        reactContextRef = reactContext
    }

    override fun getName(): String = "NotificationListenerModule"

    /**
     * Check if notification access is granted for this app.
     */
    @ReactMethod
    fun isNotificationAccessGranted(promise: Promise) {
        try {
            val context = reactApplicationContext
            val enabledListeners = Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners"
            )

            if (enabledListeners.isNullOrBlank()) {
                promise.resolve(false)
                return
            }

            val componentName = ComponentName(context, SannaNotificationListenerService::class.java)
            val enabled = TextUtils.split(enabledListeners, ":").any { listener ->
                ComponentName.unflattenFromString(listener) == componentName
            }

            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message ?: "Failed to check notification access", e)
        }
    }

    /**
     * Open Android's Notification Access settings page.
     */
    @ReactMethod
    fun openNotificationAccessSettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message ?: "Failed to open settings", e)
        }
    }

    /**
     * Get list of subscribed app package names.
     * Returns JSON array string.
     */
    @ReactMethod
    fun getSubscribedApps(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(PREFS_SUBSCRIBED_APPS_KEY, "[]") ?: "[]"
            promise.resolve(json)
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message ?: "Failed to get subscribed apps", e)
        }
    }

    /**
     * Set list of subscribed app package names.
     * @param json JSON array string of package names
     */
    @ReactMethod
    fun setSubscribedApps(json: String, promise: Promise) {
        try {
            // Validate JSON
            JSONArray(json)

            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(PREFS_SUBSCRIBED_APPS_KEY, json).apply()
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("SET_ERROR", e.message ?: "Failed to set subscribed apps", e)
        }
    }

    /**
     * Get recent buffered notifications.
     * Returns JSON array string of notification objects.
     */
    @ReactMethod
    fun getRecentNotifications(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(PREFS_NOTIFICATIONS_BUFFER_KEY, "[]") ?: "[]"
            promise.resolve(json)
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message ?: "Failed to get recent notifications", e)
        }
    }

    /**
     * Clear the notification buffer.
     */
    @ReactMethod
    fun clearNotifications(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(PREFS_NOTIFICATIONS_BUFFER_KEY, "[]").apply()
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message ?: "Failed to clear notifications", e)
        }
    }
}

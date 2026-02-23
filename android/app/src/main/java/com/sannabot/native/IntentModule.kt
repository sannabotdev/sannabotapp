package com.sannabot.native

import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*

/**
 * IntentModule – Android Intent Execution Native Module
 *
 * Allows the JS agent to fire Android Intents to open/control other apps.
 * Used by the `intent` generic tool.
 */
class IntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "IntentModule"

    /**
     * Send an Android Intent.
     *
     * @param action  Intent action (e.g. "android.intent.action.VIEW")
     * @param uri     URI string (e.g. "google.navigation:q=Vienna")
     * @param packageName  Optional package to target (e.g. "com.google.android.apps.maps")
     * @param extras  Optional JSON object of key-value extras
     * @param promise Resolves with "ok" or rejects with error
     */
    @ReactMethod
    fun sendIntent(
        action: String,
        uri: String?,
        packageName: String?,
        extras: ReadableMap?,
        promise: Promise,
    ) {
        try {
            val intent = Intent(action)

            if (!uri.isNullOrBlank()) {
                intent.data = Uri.parse(uri)
            }

            if (!packageName.isNullOrBlank()) {
                intent.setPackage(packageName)
            }

            // Add extras
            extras?.let { map ->
                val iterator = map.keySetIterator()
                while (iterator.hasNextKey()) {
                    val key = iterator.nextKey()
                    when (map.getType(key)) {
                        ReadableType.String  -> intent.putExtra(key, map.getString(key))
                        ReadableType.Number  -> intent.putExtra(key, map.getDouble(key))
                        ReadableType.Boolean -> intent.putExtra(key, map.getBoolean(key))
                        else -> { /* skip complex types */ }
                    }
                }
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            // Try from current activity first, fall back to application context
            val activity = reactApplicationContext.currentActivity
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("INTENT_ERROR", e.message ?: "Unknown error", e)
        }
    }

    /**
     * Check if an app is installed (package name query).
     */
    @ReactMethod
    fun isAppInstalled(packageName: String, promise: Promise) {
        try {
            reactApplicationContext.packageManager.getPackageInfo(packageName, 0)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}

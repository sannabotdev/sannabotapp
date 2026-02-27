package com.sannabot.native

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*

/**
 * AccessibilityModule – React Native bridge for the Sanna Accessibility Service
 *
 * Exposes:
 * - isAccessibilityServiceEnabled()  – check if the service is running
 * - openAccessibilitySettings()      – navigate to Android accessibility settings
 * - getAccessibilityTree()           – capture the current UI tree as text
 * - performAction(action, nodeId, text) – execute an action on a UI node
 *   Node actions: click, long_click, type, clear, focus, scroll_forward, scroll_backward
 *   Global actions (nodeId = null): back, home, recents, screenshot,
 *                                   clipboard_set, clipboard_get, paste
 * - performSwipe(x1, y1, x2, y2, durationMs) – swipe gesture between two coordinates
 * - waitForApp(packageName, timeoutMs) – wait until an app is in the foreground
 */
class AccessibilityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AccessibilityModule"

    /**
     * Returns true when the Sanna accessibility service is connected and running.
     */
    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        try {
            promise.resolve(SannaAccessibilityService.isRunning())
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message ?: "Failed to check accessibility service", e)
        }
    }

    /**
     * Opens the Android Accessibility Settings screen so the user can enable the service.
     */
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message ?: "Failed to open settings", e)
        }
    }

    /**
     * Captures the accessibility tree of the currently focused window and returns it
     * as a human-readable text string.
     */
    @ReactMethod
    fun getAccessibilityTree(promise: Promise) {
        try {
            val service = SannaAccessibilityService.instance
                ?: return promise.reject(
                    "SERVICE_NOT_RUNNING",
                    "Accessibility service is not enabled. " +
                    "Please go to Settings → Accessibility → Sanna and enable it."
                )
            promise.resolve(service.buildAccessibilityTree())
        } catch (e: Exception) {
            promise.reject("TREE_ERROR", e.message ?: "Failed to get accessibility tree", e)
        }
    }

    /**
     * Perform an action on a UI element or a global action.
     *
     * @param action  Node actions: click | long_click | type | clear | focus |
     *                scroll_forward | scroll_backward
     *                Global actions (pass null for nodeId): back | home | recents |
     *                screenshot | clipboard_set | clipboard_get | paste
     * @param nodeId  Node ID from the tree (e.g. "node_5"). Null for global actions.
     * @param text    Text value for "type" or "clipboard_set" actions, null otherwise.
     */
    @ReactMethod
    fun performAction(action: String, nodeId: String?, text: String?, promise: Promise) {
        try {
            val service = SannaAccessibilityService.instance
                ?: return promise.reject(
                    "SERVICE_NOT_RUNNING",
                    "Accessibility service is not enabled."
                )
            promise.resolve(service.performNodeAction(action, nodeId, text))
        } catch (e: Exception) {
            promise.reject("ACTION_ERROR", e.message ?: "Failed to perform action", e)
        }
    }

    /**
     * Dispatch a swipe gesture from (x1, y1) to (x2, y2) over the given duration.
     * Runs on a background thread to avoid blocking the React Native bridge.
     *
     * @param x1         Start X in screen pixels
     * @param y1         Start Y in screen pixels
     * @param x2         End X in screen pixels
     * @param y2         End Y in screen pixels
     * @param durationMs Gesture duration in milliseconds (min 1)
     */
    @ReactMethod
    fun performSwipe(x1: Int, y1: Int, x2: Int, y2: Int, durationMs: Int, promise: Promise) {
        try {
            val service = SannaAccessibilityService.instance
                ?: return promise.reject(
                    "SERVICE_NOT_RUNNING",
                    "Accessibility service is not enabled."
                )
            // Run on background thread – performSwipe blocks via CountDownLatch
            Thread {
                try {
                    promise.resolve(service.performSwipe(x1, y1, x2, y2, durationMs))
                } catch (e: Exception) {
                    promise.reject("SWIPE_ERROR", e.message ?: "Failed to perform swipe", e)
                }
            }.start()
        } catch (e: Exception) {
            promise.reject("SWIPE_ERROR", e.message ?: "Failed to perform swipe", e)
        }
    }

    /**
     * Block until the specified package is in the foreground or timeoutMs elapses.
     * Returns true if the app became active in time, false on timeout.
     */
    @ReactMethod
    fun waitForApp(packageName: String, timeoutMs: Int, promise: Promise) {
        try {
            val service = SannaAccessibilityService.instance
                ?: return promise.reject(
                    "SERVICE_NOT_RUNNING",
                    "Accessibility service is not enabled."
                )
            // Run on background thread to avoid blocking the bridge thread
            Thread {
                try {
                    val result = service.waitForPackage(packageName, timeoutMs.toLong())
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject("WAIT_ERROR", e.message ?: "Failed to wait for app", e)
                }
            }.start()
        } catch (e: Exception) {
            promise.reject("WAIT_ERROR", e.message ?: "Failed to wait for app", e)
        }
    }
}

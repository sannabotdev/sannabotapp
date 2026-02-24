package com.sannabot.native

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * AccessibilityJobModule – React Native bridge to start the AccessibilityHeadlessService.
 *
 * Called by the TypeScript `accessibility-tool.ts` BEFORE opening the target app.
 * The HeadlessJS task (SannaAccessibilityTask) runs the full automation in a
 * separate JS context that is not throttled when SannaBot is in the background.
 *
 * Methods exposed to JS:
 *   startJob(jobJson: String): Promise<void>
 *     Starts AccessibilityHeadlessService with the serialized job parameters.
 */
class AccessibilityJobModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AccessibilityJobModule"

    @ReactMethod
    fun startJob(jobJson: String, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, AccessibilityHeadlessService::class.java)
            intent.putExtra("jobJson", jobJson)
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("JOB_START_ERROR", e.message ?: "Failed to start accessibility job", e)
        }
    }
}

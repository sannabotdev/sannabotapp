package com.sannabot.native

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * TimerHeadlessService – Runs the JS timer message formatting task in the background.
 *
 * React Native's HeadlessJsTaskService starts the JS runtime (if not running)
 * and dispatches the registered headless task with the timer data.
 *
 * The JS task (timer-headless.ts) uses the LLM to format a user-friendly message.
 */
class TimerHeadlessService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null

        val data = Arguments.createMap().apply {
            putString("timerId", extras.getString("timerId", ""))
        }

        return HeadlessJsTaskConfig(
            "SannaTimerTask",   // Must match AppRegistry.registerHeadlessTask name
            data,
            30_000,                // Timeout: 30 seconds (should be quick)
            true                   // Allow task in foreground too
        )
    }
}

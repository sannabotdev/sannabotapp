package com.sannabot.native

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * SchedulerHeadlessService – Runs the JS sub-agent in the background.
 *
 * React Native's HeadlessJsTaskService starts the JS runtime (if not running)
 * and dispatches the registered headless task with the schedule data.
 *
 * The JS task (scheduler-headless.ts) creates a mini ConversationPipeline
 * and executes the stored instruction.
 */
class SchedulerHeadlessService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null

        val data = Arguments.createMap().apply {
            putString("scheduleId", extras.getString("scheduleId", ""))
        }

        return HeadlessJsTaskConfig(
            "SannaSchedulerTask",   // Must match AppRegistry.registerHeadlessTask name
            data,
            120_000,                  // Timeout: 2 minutes for sub-agent execution
            true                      // Allow task in foreground too
        )
    }
}

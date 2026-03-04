package com.sannabot.native

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * SannaPackage – Registers all native modules with React Native
 */
class SannaPackage : ReactPackage {
    @Suppress("DEPRECATION")
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            IntentModule(reactContext),
            TTSModule(reactContext),
            WakeWordModule(reactContext),
            AudioRecorderModule(reactContext),
            AudioPlayerModule(reactContext),
            DeviceQueryModule(reactContext),
            SpeechModule(reactContext),
            SmsModule(reactContext),
            SchedulerModule(reactContext),
            TimerModule(reactContext),
            NotificationListenerModule(reactContext),
            KeepAwakeModule(reactContext),
            AccessibilityModule(reactContext),
            AccessibilityJobModule(reactContext),
            VolumeModule(reactContext),
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}

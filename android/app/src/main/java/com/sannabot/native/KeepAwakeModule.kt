package com.sannabot.native

import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * KeepAwakeModule – Prevents the screen from turning off.
 *
 * Uses FLAG_KEEP_SCREEN_ON on the Activity window.
 * No additional Android permission required.
 *
 * JS API:
 *   import { NativeModules } from 'react-native';
 *   NativeModules.KeepAwakeModule.activate();
 *   NativeModules.KeepAwakeModule.deactivate();
 */
class KeepAwakeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KeepAwakeModule"

    @ReactMethod
    fun activate() {
        val activity = reactApplicationContext.currentActivity ?: return
        Handler(Looper.getMainLooper()).post {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    @ReactMethod
    fun deactivate() {
        val activity = reactApplicationContext.currentActivity ?: return
        Handler(Looper.getMainLooper()).post {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
}

package com.sannabot.native

import android.content.Context
import android.media.AudioManager
import com.facebook.react.bridge.*

/**
 * VolumeModule – Get and set media volume
 *
 * Exposes getVolume() and setVolume(level) to JavaScript.
 * Volume is handled as a float 0.0–1.0 (percentage of max).
 */
class VolumeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VolumeManager"

    private val audioManager: AudioManager
        get() = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    /**
     * Returns the current media volume as a float 0.0–1.0.
     */
    @ReactMethod
    fun getVolume(promise: Promise) {
        try {
            val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val volume = if (max > 0) current.toDouble() / max.toDouble() else 0.0
            promise.resolve(volume)
        } catch (e: Exception) {
            promise.reject("VOLUME_ERROR", e.message ?: "Unknown error", e)
        }
    }

    /**
     * Sets the media volume.
     * @param level Float 0.0–1.0 representing the desired volume percentage.
     */
    @ReactMethod
    fun setVolume(level: Double, promise: Promise) {
        try {
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val target = (level.coerceIn(0.0, 1.0) * max).toInt()
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
            // Return the actual volume set (may differ due to rounding)
            val actual = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            val actualPercent = if (max > 0) actual.toDouble() / max.toDouble() else 0.0
            promise.resolve(actualPercent)
        } catch (e: Exception) {
            promise.reject("VOLUME_ERROR", e.message ?: "Unknown error", e)
        }
    }
}

package com.sannabot.native

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

/**
 * TTSModule – Android TextToSpeech Engine Native Module
 *
 * Wraps Android's TextToSpeech API for use from React Native.
 * Emits events:
 *   - tts_started:  { utteranceId }
 *   - tts_done:     { utteranceId }
 *   - tts_error:    { utteranceId, error }
 */
class TTSModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var isReady = false
    private var pendingSpeak: (() -> Unit)? = null

    init {
        tts = TextToSpeech(reactContext, this)
    }

    override fun getName(): String = "TTSModule"

    // Required by NativeEventEmitter on Android
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isReady = true
            tts?.language = Locale.GERMAN
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    sendEvent("tts_started", Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                    })
                }

                override fun onDone(utteranceId: String?) {
                    sendEvent("tts_done", Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                    })
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    sendEvent("tts_error", Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                        putString("error", "TTS error")
                    })
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                    sendEvent("tts_error", Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                        putString("error", "TTS error code: $errorCode")
                    })
                }
            })
            pendingSpeak?.invoke()
            pendingSpeak = null
        }
    }

    /**
     * Speak text via TTS.
     *
     * @param text        Text to speak
     * @param language    BCP-47 language tag (e.g. "de-AT", "en-US")
     * @param utteranceId Optional ID to track this utterance
     */
    @ReactMethod
    fun speak(text: String, language: String?, utteranceId: String?, promise: Promise) {
        val uid = utteranceId ?: "utterance_${System.currentTimeMillis()}"

        val doSpeak = {
            try {
                language?.let {
                    tts?.language = Locale.forLanguageTag(it)
                }
                val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, uid)
                if (result == TextToSpeech.SUCCESS) {
                    promise.resolve(uid)
                } else {
                    promise.reject("TTS_ERROR", "TTS speak returned error: $result")
                }
            } catch (e: Exception) {
                promise.reject("TTS_ERROR", e.message ?: "Unknown error", e)
            }
        }

        if (isReady) {
            doSpeak()
        } else {
            pendingSpeak = doSpeak
        }
    }

    /** Stop ongoing TTS playback */
    @ReactMethod
    fun stop(promise: Promise) {
        tts?.stop()
        promise.resolve("ok")
    }

    /** Check if TTS is currently speaking */
    @ReactMethod
    fun isSpeaking(promise: Promise) {
        promise.resolve(tts?.isSpeaking ?: false)
    }

    /** Set speech rate (1.0 = normal, 0.5 = slow, 2.0 = fast) */
    @ReactMethod
    fun setSpeechRate(rate: Float, promise: Promise) {
        tts?.setSpeechRate(rate)
        promise.resolve("ok")
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onCatalystInstanceDestroy() {
        tts?.shutdown()
        tts = null
        super.onCatalystInstanceDestroy()
    }
}

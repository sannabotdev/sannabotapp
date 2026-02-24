package com.sannabot.native

import android.media.AudioManager
import android.media.ToneGenerator
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
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

    companion object {
        private const val TAG = "TTSModule"

        /** Map regional variants to main locale for TTS voice selection (same as SpeechModule) */
        private val ON_DEVICE_LANGUAGE_MAP = mapOf(
            "de_AT" to "de_DE",
            "de_CH" to "de_DE",
            "en_GB" to "en_US",
            "en_AU" to "en_US",
            "en_CA" to "en_US",
            "en_NZ" to "en_US",
            "en_IN" to "en_US",
            "fr_BE" to "fr_FR",
            "fr_CA" to "fr_FR",
            "fr_CH" to "fr_FR",
            "es_AR" to "es_ES",
            "es_MX" to "es_ES",
            "es_CO" to "es_ES",
            "pt_BR" to "pt_PT",
            "it_CH" to "it_IT",
        )
    }

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
            setLanguageWithFallback("en-US")
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
                    setLanguageWithFallback(it)
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

    /**
     * Play a beep / alert tone.
     *
     * @param toneType  Android ToneGenerator tone constant (default: TONE_PROP_BEEP = 24)
     *                  Common values:
     *                    24 = TONE_PROP_BEEP  (short beep)
     *                    25 = TONE_PROP_ACK   (acknowledgement double-beep)
     *                    27 = TONE_PROP_PROMPT (attention prompt)
     * @param durationMs  How long the tone plays in ms (default: 500)
     * @param count       Number of beeps to play (default: 1, with 300ms pause between)
     */
    @ReactMethod
    fun playBeep(toneType: Int, durationMs: Int, count: Int, promise: Promise) {
        val type = if (toneType >= 0) toneType else ToneGenerator.TONE_PROP_BEEP
        val duration = if (durationMs > 0) durationMs else 500
        val repeats = if (count > 0) count.coerceAtMost(10) else 1
        val pauseMs = 300L

        CoroutineScope(Dispatchers.IO).launch {
            var generator: ToneGenerator? = null
            try {
                generator = ToneGenerator(AudioManager.STREAM_ALARM, 100)
                for (i in 0 until repeats) {
                    generator.startTone(type, duration)
                    delay(duration.toLong())
                    if (i < repeats - 1) {
                        delay(pauseMs)
                    }
                }
                withContext(Dispatchers.Main) {
                    promise.resolve("ok")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("BEEP_ERROR", e.message ?: "Failed to play beep", e)
                }
            } finally {
                generator?.release()
            }
        }
    }

    /**
     * Set TTS language with fallback chain (same strategy as SpeechModule):
     * 1. Exact locale (e.g. de-AT)
     * 2. Mapped locale (e.g. de-AT → de-DE via ON_DEVICE_LANGUAGE_MAP)
     * 3. Base language (e.g. de)
     * On each successful step, selectBestVoice() is called.
     */
    private fun setLanguageWithFallback(language: String) {
        val normalized = language.replace("-", "_")
        val candidates = listOfNotNull(
            normalized,
            ON_DEVICE_LANGUAGE_MAP[normalized],
            normalized.substringBefore("_").takeIf { it != normalized },
        ).distinct()

        for (tag in candidates) {
            val locale = Locale.forLanguageTag(tag.replace("_", "-"))
            val result = tts?.setLanguage(locale)
            if (result != TextToSpeech.LANG_MISSING_DATA &&
                result != TextToSpeech.LANG_NOT_SUPPORTED) {
                android.util.Log.i(TAG, "TTS language set to: $tag (requested: $language)")
                selectBestVoice(locale)
                return
            }
            android.util.Log.w(TAG, "TTS locale not supported: $tag (result=$result)")
        }
        android.util.Log.w(TAG, "No supported TTS locale found for: $language")
    }

    /**
     * Pick the highest-quality offline voice whose language matches the given locale.
     */
    private fun selectBestVoice(locale: Locale) {
        val best = tts?.voices
            ?.filter { voice ->
                voice.locale.language == locale.language &&
                !voice.isNetworkConnectionRequired
            }
            ?.maxByOrNull { it.quality }
            ?: return

        tts?.voice = best
        android.util.Log.i(TAG, "Selected TTS voice: ${best.name} " +
                "(quality=${best.quality}, locale=${best.locale})")
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

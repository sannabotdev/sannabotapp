package com.sannabot.native

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.concurrent.Executors

/**
 * SpeechModule – Android SpeechRecognizer (on-device STT)
 *
 * No external package needed – uses Android's built-in SpeechRecognizer.
 *
 * Recognition strategy (mode-dependent):
 *   auto mode:   Uses checkRecognitionSupport (API 33+) to determine if the
 *                requested language is available on-device. If yes → on-device
 *                first, cloud fallback. If no → cloud first, on-device fallback.
 *                This fixes Samsung devices that silently recognise in the wrong
 *                language when the requested locale is not installed offline.
 *   offline:     1. On-device with normalised language
 *                2. On-device with base language
 *   online:      1. Cloud-based recognizer only
 *
 * Events emitted:
 *   - speech_results:        { value: string[] }  – final results
 *   - speech_partial_results: { value: string[] } – partial results
 *   - speech_end:            {}
 *   - speech_error:          { code: int, message: string }
 *   - speech_volume_changed: { value: float }
 */
class SpeechModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "SpeechModule"

        /** Map regional variants to main locale for on-device recognizer */
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

        private const val ERROR_LANGUAGE_NOT_SUPPORTED = 12
        private const val ERROR_LANGUAGE_UNAVAILABLE = 13
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false

    // Retry state: tracks which strategies have been tried for the current request
    private var currentLanguage: String = ""
    private var currentMode: String = "auto"
    private var retriesLeft = 0
    private var triedOnDeviceNormalised = false
    private var triedOnDeviceBase = false
    private var triedCloud = false

    // Debug: tracks which strategy is currently active (for logging)
    private var activeStrategyType: String = ""   // "offline" or "online"
    private var activeStrategyLanguage: String = ""

    override fun getName(): String = "SpeechModule"

    // Required by NativeEventEmitter
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    /**
     * Start listening for speech.
     * @param language BCP-47 tag, e.g. "de-AT", "en-US"
     * @param mode "auto" (smart detection), "offline" (on-device only), "online" (cloud only)
     */
    @ReactMethod
    fun startListening(language: String, mode: String, promise: Promise) {
        val hasCloud = SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)
        val hasOnDevice = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            SpeechRecognizer.isOnDeviceRecognitionAvailable(reactApplicationContext)
        } else false

        if (!hasCloud && !hasOnDevice) {
            promise.reject("NOT_AVAILABLE", "Speech recognition not available on this device")
            return
        }

        // Reset retry state
        currentLanguage = language.replace("-", "_")
        currentMode = mode
        retriesLeft = 3

        // For explicit modes, pre-set flags and start immediately
        when (mode) {
            "offline" -> {
                triedCloud = true
                triedOnDeviceNormalised = false
                triedOnDeviceBase = false
                reactApplicationContext.currentActivity?.runOnUiThread {
                    startWithNextStrategy()
                    promise.resolve("ok")
                } ?: promise.reject("NO_ACTIVITY", "No active Activity")
            }
            "online" -> {
                triedCloud = false
                triedOnDeviceNormalised = true
                triedOnDeviceBase = true
                reactApplicationContext.currentActivity?.runOnUiThread {
                    startWithNextStrategy()
                    promise.resolve("ok")
                } ?: promise.reject("NO_ACTIVITY", "No active Activity")
            }
            else -> { // "auto"
                // On API 33+, use checkRecognitionSupport to determine if the
                // requested language is actually available on-device before trying.
                if (hasOnDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    checkLanguageAndStart(promise)
                } else {
                    // < API 33: no on-device recognizer, just use cloud
                    triedCloud = false
                    triedOnDeviceNormalised = true
                    triedOnDeviceBase = true
                    reactApplicationContext.currentActivity?.runOnUiThread {
                        startWithNextStrategy()
                        promise.resolve("ok")
                    } ?: promise.reject("NO_ACTIVITY", "No active Activity")
                }
            }
        }
    }

    /**
     * API 33+: Check if the requested language is available on-device before
     * deciding on the strategy order. This prevents Samsung devices from
     * silently recognising in the wrong language.
     *
     * Must dispatch to UI thread because SpeechRecognizer requires it.
     */
    @androidx.annotation.RequiresApi(Build.VERSION_CODES.TIRAMISU)
    private fun checkLanguageAndStart(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No active Activity")
            return
        }

        activity.runOnUiThread {
            val intent = buildIntent(currentLanguage)
            val tempRecognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(reactApplicationContext)

            try {
                tempRecognizer.checkRecognitionSupport(
                    intent,
                    Executors.newSingleThreadExecutor(),
                    object : RecognitionSupportCallback {
                        override fun onSupportResult(support: RecognitionSupport) {
                            val installedLanguages = support.installedOnDeviceLanguages
                            val baseLang = currentLanguage.substringBefore("_")
                            val normalisedLang = ON_DEVICE_LANGUAGE_MAP[currentLanguage] ?: currentLanguage

                            // Check if ANY variant of the requested language is installed
                            val langAvailableOnDevice = installedLanguages.any { installed ->
                                val installedNorm = installed.replace("-", "_")
                                installedNorm == currentLanguage ||
                                installedNorm == normalisedLang ||
                                installedNorm.startsWith("${baseLang}_") ||
                                installedNorm == baseLang
                            }

                            Log.i(TAG, "checkRecognitionSupport: installed=$installedLanguages, " +
                                    "requested=$currentLanguage, available=$langAvailableOnDevice")

                            if (langAvailableOnDevice) {
                                // Language IS installed on-device → on-device first
                                triedOnDeviceNormalised = false
                                triedOnDeviceBase = false
                                triedCloud = false
                            } else {
                                // Language NOT installed on-device → cloud first
                                triedCloud = false
                                triedOnDeviceNormalised = true
                                triedOnDeviceBase = true
                            }

                            // Dispatch back to UI thread for SpeechRecognizer creation
                            activity.runOnUiThread {
                                tempRecognizer.destroy()
                                startWithNextStrategy()
                                promise.resolve("ok")
                            }
                        }

                        override fun onError(error: Int) {
                            Log.w(TAG, "checkRecognitionSupport error $error, falling back to cloud first")

                            // On error, fall back to cloud-first (safe default)
                            triedCloud = false
                            triedOnDeviceNormalised = true
                            triedOnDeviceBase = true

                            activity.runOnUiThread {
                                tempRecognizer.destroy()
                                startWithNextStrategy()
                                promise.resolve("ok")
                            }
                        }
                    }
                )
            } catch (e: Exception) {
                tempRecognizer.destroy()
                Log.w(TAG, "checkRecognitionSupport exception, falling back to cloud first", e)

                // On exception, fall back to cloud-first (safe default)
                triedCloud = false
                triedOnDeviceNormalised = true
                triedOnDeviceBase = true

                startWithNextStrategy()
                promise.resolve("ok")
            }
        }
    }

    /**
     * Try the next recognition strategy.
     * Called initially and on language errors (12/13) to auto-fallback.
     *
     * Strategy order depends on flags set by startListening / checkLanguageAndStart:
     *   - On-device first (triedCloud=false, triedOnDevice*=false)
     *   - Cloud first (triedCloud=false, triedOnDevice*=true)
     */
    private fun startWithNextStrategy() {
        if (retriesLeft <= 0) {
            Log.e(TAG, "All recognition strategies exhausted")
            sendEvent("speech_error", Arguments.createMap().apply {
                putInt("code", ERROR_LANGUAGE_NOT_SUPPORTED)
                putString("message",
                    "Speech recognition not available. Please download the " +
                    "language pack (Settings → System → Languages → " +
                    "Speech recognition) or sign in with a Google account.")
            })
            return
        }
        retriesLeft--

        val hasOnDevice = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            SpeechRecognizer.isOnDeviceRecognitionAvailable(reactApplicationContext)
        } else false

        try {
            destroyRecognizer()

            when {
                // On-device with normalised language (de_AT → de_DE)
                hasOnDevice && !triedOnDeviceNormalised -> {
                    triedOnDeviceNormalised = true
                    val lang = ON_DEVICE_LANGUAGE_MAP[currentLanguage] ?: currentLanguage
                    activeStrategyType = "offline"
                    activeStrategyLanguage = lang
                    Log.i(TAG, "[Strategy] On-device recognizer, language=$lang")

                    val recognizer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        SpeechRecognizer.createOnDeviceSpeechRecognizer(reactApplicationContext)
                    } else {
                        SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
                    }
                    speechRecognizer = recognizer
                    recognizer.setRecognitionListener(createRetryingListener())
                    recognizer.startListening(buildIntent(lang))
                }

                // On-device with just base language (e.g. "de")
                hasOnDevice && !triedOnDeviceBase -> {
                    triedOnDeviceBase = true
                    val baseLang = currentLanguage.substringBefore("_")
                    activeStrategyType = "offline"
                    activeStrategyLanguage = baseLang
                    Log.i(TAG, "[Strategy] On-device recognizer, base language=$baseLang")

                    val recognizer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        SpeechRecognizer.createOnDeviceSpeechRecognizer(reactApplicationContext)
                    } else {
                        SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
                    }
                    speechRecognizer = recognizer
                    recognizer.setRecognitionListener(createRetryingListener())
                    recognizer.startListening(buildIntent(baseLang))
                }

                // Cloud-based recognizer (original language)
                !triedCloud -> {
                    triedCloud = true
                    activeStrategyType = "online"
                    activeStrategyLanguage = currentLanguage
                    Log.i(TAG, "[Strategy] Cloud-based recognizer, language=$currentLanguage")

                    val recognizer = SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
                    speechRecognizer = recognizer
                    recognizer.setRecognitionListener(createRetryingListener())
                    recognizer.startListening(buildIntent(currentLanguage))
                }

                // All strategies exhausted
                else -> {
                    Log.e(TAG, "All recognition strategies exhausted")
                    sendEvent("speech_error", Arguments.createMap().apply {
                        putInt("code", ERROR_LANGUAGE_NOT_SUPPORTED)
                        putString("message",
                            "Speech recognition not available. Please download the " +
                            "language pack in device settings or " +
                            "sign in with a Google account.")
                    })
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recognition strategy", e)
            // Try next strategy
            startWithNextStrategy()
        }
    }

    /**
     * Build the speech recognition Intent for the given language.
     * Converts underscores to hyphens (BCP-47 format) because that's what
     * EXTRA_LANGUAGE expects. Uses Locale.forLanguageTag() for proper formatting.
     */
    private fun buildIntent(language: String): Intent {
        // Ensure BCP-47 format (hyphens, not underscores)
        val bcp47 = language.replace("_", "-")
        val locale = Locale.forLanguageTag(bcp47)
        val tag = locale.toLanguageTag()   // e.g. "de-AT", "de-DE", "en-US"

        Log.d(TAG, "buildIntent: input=$language → bcp47=$bcp47 → tag=$tag")

        return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, tag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, tag)
            // Force the recognizer to use the specified language, not device default
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, tag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
    }

    /**
     * Create a RecognitionListener that auto-retries with the next strategy
     * on language errors (12/13), and forwards all other events to JS.
     */
    private fun createRetryingListener(): RecognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            isListening = true
            Log.d(TAG, "Ready for speech")
        }

        override fun onBeginningOfSpeech() {
            Log.d(TAG, "Speech started")
        }

        override fun onRmsChanged(rmsdB: Float) {
            sendEvent("speech_volume_changed", Arguments.createMap().apply {
                putDouble("value", rmsdB.toDouble())
            })
        }

        override fun onBufferReceived(buffer: ByteArray?) {}

        override fun onEndOfSpeech() {
            isListening = false
            Log.d(TAG, "Speech ended")
            sendEvent("speech_end", Arguments.createMap())
        }

        override fun onError(error: Int) {
            isListening = false
            val message = speechErrorMessage(error)
            Log.e(TAG, "Speech error $error: $message")

            // Auto-retry on language errors
            if (error == ERROR_LANGUAGE_NOT_SUPPORTED || error == ERROR_LANGUAGE_UNAVAILABLE) {
                Log.i(TAG, "Language not supported, trying next strategy...")
                startWithNextStrategy()
                return
            }

            // Forward all other errors to JS
            sendEvent("speech_error", Arguments.createMap().apply {
                putInt("code", error)
                putString("message", message)
            })
        }

        override fun onResults(results: Bundle?) {
            isListening = false
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            Log.i(TAG, "✓ Results via $activeStrategyType (lang=$activeStrategyLanguage, " +
                    "mode=$currentMode): ${matches?.firstOrNull() ?: "(empty)"}")
            val arr = Arguments.createArray()
            matches?.forEach { arr.pushString(it) }
            sendEvent("speech_results", Arguments.createMap().apply {
                putArray("value", arr)
                putString("strategyType", activeStrategyType)
                putString("strategyLanguage", activeStrategyLanguage)
            })
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            if (!matches.isNullOrEmpty()) {
                val arr = Arguments.createArray()
                matches.forEach { arr.pushString(it) }
                sendEvent("speech_partial_results", Arguments.createMap().apply {
                    putArray("value", arr)
                })
            }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    /** Stop listening (returns partial result via events) */
    @ReactMethod
    fun stopListening(promise: Promise) {
        reactApplicationContext.currentActivity?.runOnUiThread {
            speechRecognizer?.stopListening()
            isListening = false
            promise.resolve("ok")
        } ?: promise.reject("NO_ACTIVITY", "No active Activity")
    }

    /** Cancel and destroy recognizer */
    @ReactMethod
    fun cancel(promise: Promise) {
        reactApplicationContext.currentActivity?.runOnUiThread {
            destroyRecognizer()
            promise.resolve("ok")
        } ?: promise.reject("NO_ACTIVITY", "No active Activity")
    }

    /** Check if speech recognition is available */
    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactApplicationContext))
    }

    @ReactMethod
    fun isListening(promise: Promise) {
        promise.resolve(isListening)
    }

    private fun destroyRecognizer() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        isListening = false
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun speechErrorMessage(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO                   -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT                  -> "Client side error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS-> "Insufficient permissions"
        SpeechRecognizer.ERROR_NETWORK                 -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT         -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH                -> "No speech match"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY         -> "Recognizer busy"
        SpeechRecognizer.ERROR_SERVER                  -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT          -> "No speech input"
        11 /* ERROR_SERVER_DISCONNECTED (API 28+) */   -> "Server disconnected"
        ERROR_LANGUAGE_NOT_SUPPORTED                   -> "Language not supported"
        ERROR_LANGUAGE_UNAVAILABLE                     -> "Language unavailable"
        else                                           -> "Unknown error: $error"
    }

    override fun onCatalystInstanceDestroy() {
        destroyRecognizer()
        super.onCatalystInstanceDestroy()
    }
}

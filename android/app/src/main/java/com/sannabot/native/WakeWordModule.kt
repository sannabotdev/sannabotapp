package com.sannabot.native

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import ai.picovoice.porcupine.*

/**
 * WakeWordModule – Wake Word Detection with Picovoice Porcupine + Android Foreground Service
 *
 * Listens permanently in background for the wake word using Porcupine on-device detection.
 * Uses PorcupineManager which handles its own AudioRecord internally.
 *
 * Events emitted:
 *   - wake_word_detected: { keyword: string, timestamp: number }
 *   - wake_word_error:    { error: string }
 */
class WakeWordModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WakeWordModule"

    // Required by NativeEventEmitter on Android
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    /** Start wake word detection (starts the Foreground Service) */
    @ReactMethod
    fun startListening(accessKey: String, keywordPath: String?, promise: Promise) {
        try {
            val intent = Intent(reactContext, WakeWordService::class.java).apply {
                putExtra("ACCESS_KEY", accessKey)
                putExtra("KEYWORD_PATH", keywordPath ?: "PORCUPINE")
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            WakeWordService.eventEmitter = { keyword ->
                sendEvent("wake_word_detected", Arguments.createMap().apply {
                    putString("keyword", keyword)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                })
            }
            WakeWordService.errorEmitter = { error ->
                sendEvent("wake_word_error", Arguments.createMap().apply {
                    putString("error", error)
                })
            }
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("WAKE_WORD_ERROR", e.message ?: "Unknown error", e)
        }
    }

    /** Stop wake word detection */
    @ReactMethod
    fun stopListening(promise: Promise) {
        try {
            val intent = Intent(reactContext, WakeWordService::class.java)
            reactContext.stopService(intent)
            WakeWordService.eventEmitter = null
            WakeWordService.errorEmitter = null
            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("WAKE_WORD_ERROR", e.message ?: "Unknown error", e)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}

/**
 * WakeWordService – Android Foreground Service with Picovoice Porcupine.
 *
 * Uses PorcupineManager for built-in keywords, or raw Porcupine + AudioRecord
 * for custom .ppn keyword files.
 *
 * Runs in background even when the app is minimized.
 *
 * Keyword resolution order:
 *   1. Custom .ppn file in assets/ (e.g. "hey-sanna_de_android_v4_0_0.ppn")
 *   2. Absolute path to a .ppn file on the filesystem
 *   3. Built-in names: "PORCUPINE", "ALEXA", "JARVIS", "HEY_GOOGLE", etc.
 *
 * For custom "Hey Sanna" wake word:
 *   - Train on https://console.picovoice.ai/ → Porcupine
 *   - Download .ppn for Android, place in android/app/src/main/assets/
 *   - Pass the filename (without path) as keywordPath
 */
class WakeWordService : Service() {

    companion object {
        const val CHANNEL_ID = "sanna_wake_word_channel"
        const val NOTIFICATION_ID = 1001
        var eventEmitter: ((String) -> Unit)? = null
        var errorEmitter: ((String) -> Unit)? = null
        private const val TAG = "WakeWordService"

        /**
         * Default custom keyword filename in assets/.
         * Looks for any .ppn file matching this prefix.
         * Falls back to built-in "PORCUPINE" if not found.
         */
        const val CUSTOM_KEYWORD_ASSET_PREFIX = "hey-sanna"
    }

    private var porcupineManager: PorcupineManager? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        val accessKey = intent?.getStringExtra("ACCESS_KEY") ?: ""
        val keywordPath = intent?.getStringExtra("KEYWORD_PATH") ?: "PORCUPINE"
        val modelPath = intent?.getStringExtra("MODEL_PATH")

        startDetection(accessKey, keywordPath, modelPath)

        return START_STICKY
    }

    /**
     * Find a .ppn file in assets/ whose name starts with the given prefix.
     * Returns the asset filename or null if not found.
     */
    private fun findKeywordAsset(prefix: String): String? {
        return try {
            val assetFiles = applicationContext.assets.list("") ?: emptyArray()
            assetFiles.firstOrNull { it.startsWith(prefix, ignoreCase = true) && it.endsWith(".ppn") }
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Could not list assets: ${e.message}")
            null
        }
    }

    /**
     * Find a .pv model file in assets/ whose name starts with the given prefix.
     * Returns the asset filename or null if not found.
     */
    private fun findModelAsset(prefix: String): String? {
        return try {
            val assetFiles = applicationContext.assets.list("") ?: emptyArray()
            assetFiles.firstOrNull { it.startsWith(prefix, ignoreCase = true) && it.endsWith(".pv") }
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Could not list assets for model: ${e.message}")
            null
        }
    }

    private fun startDetection(accessKey: String, keywordPath: String, modelPath: String?) {
        try {
            val callback = PorcupineManagerCallback { keywordIndex ->
                android.util.Log.i(TAG, "Wake word detected! index=$keywordIndex")
                eventEmitter?.invoke("hey_sanna")
            }

            val errorCallback = PorcupineManagerErrorCallback { error ->
                val msg = "[${error::class.java.simpleName}] ${error.message}"
                android.util.Log.e(TAG, "Porcupine runtime error: $msg")
                errorEmitter?.invoke(msg)
            }

            // 1. Check if a custom .ppn keyword file exists in assets
            val assetKeyword = findKeywordAsset(CUSTOM_KEYWORD_ASSET_PREFIX)
            // Also look for a custom language model (.pv) in assets
            val assetModel = modelPath ?: findModelAsset("porcupine_params")

            if (assetKeyword != null) {
                // Custom keyword from assets (e.g. "Hey Sanna" trained on Picovoice Console)
                android.util.Log.i(TAG, "Using custom keyword from assets: $assetKeyword" +
                    if (assetModel != null) " with model: $assetModel" else "")

                val builder = PorcupineManager.Builder()
                    .setAccessKey(accessKey)
                    .setKeywordPath(assetKeyword)
                    .setSensitivity(0.65f)
                    .setErrorCallback(errorCallback)

                if (assetModel != null) {
                    builder.setModelPath(assetModel)
                }

                porcupineManager = builder.build(applicationContext, callback)
            } else {
                // Try to resolve as built-in keyword
                val builtIn = resolveBuiltInKeyword(keywordPath)

                porcupineManager = if (builtIn != null) {
                    // Built-in keyword (e.g. PORCUPINE, JARVIS, ALEXA)
                    android.util.Log.i(TAG, "Using built-in keyword: $builtIn")
                    PorcupineManager.Builder()
                        .setAccessKey(accessKey)
                        .setKeyword(builtIn)
                        .setSensitivity(0.7f)
                        .setErrorCallback(errorCallback)
                        .build(applicationContext, callback)
                } else {
                    // Custom .ppn keyword file path (absolute path)
                    android.util.Log.i(TAG, "Using custom keyword path: $keywordPath")
                    val builder = PorcupineManager.Builder()
                        .setAccessKey(accessKey)
                        .setKeywordPath(keywordPath)
                        .setSensitivity(0.7f)
                        .setErrorCallback(errorCallback)

                    if (assetModel != null) {
                        builder.setModelPath(assetModel)
                    }

                    builder.build(applicationContext, callback)
                }
            }

            porcupineManager?.start()
            android.util.Log.i(TAG, "Porcupine started listening")

        } catch (e: PorcupineActivationException) {
            val msg = "Porcupine activation failed (access key rejected/expired). Renew key at console.picovoice.ai: ${e.message}"
            android.util.Log.e(TAG, msg)
            errorEmitter?.invoke(msg)
        } catch (e: PorcupineActivationLimitException) {
            val msg = "Porcupine activation limit reached for this access key: ${e.message}"
            android.util.Log.e(TAG, msg)
            errorEmitter?.invoke(msg)
        } catch (e: PorcupineActivationThrottledException) {
            val msg = "Porcupine activation throttled – too many requests: ${e.message}"
            android.util.Log.e(TAG, msg)
            errorEmitter?.invoke(msg)
        } catch (e: PorcupineActivationRefusedException) {
            val msg = "Porcupine activation refused – access key may be used on too many devices: ${e.message}"
            android.util.Log.e(TAG, msg)
            errorEmitter?.invoke(msg)
        } catch (e: PorcupineKeyException) {
            val msg = "Porcupine invalid/malformed access key: ${e.message}"
            android.util.Log.e(TAG, msg)
            errorEmitter?.invoke(msg)
        } catch (e: PorcupineInvalidArgumentException) {
            val msg = "Porcupine invalid argument (model/keyword file mismatch or bad path): ${e.message}"
            android.util.Log.e(TAG, msg)
            errorEmitter?.invoke(msg)
        } catch (e: PorcupineException) {
            val msg = "Porcupine init failed [${e::class.java.simpleName}]: ${e.message}"
            android.util.Log.e(TAG, msg)
            errorEmitter?.invoke(msg)
        }
    }

    /**
     * Try to map a string like "PORCUPINE" or "JARVIS" to a Porcupine BuiltInKeyword.
     * Returns null if no match (indicating a custom .ppn path).
     */
    private fun resolveBuiltInKeyword(name: String): Porcupine.BuiltInKeyword? {
        return try {
            Porcupine.BuiltInKeyword.valueOf(name.uppercase())
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    override fun onDestroy() {
        try {
            porcupineManager?.stop()
            porcupineManager?.delete()
        } catch (e: PorcupineException) {
            android.util.Log.e(TAG, "Error stopping Porcupine: ${e.message}")
        }
        porcupineManager = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Sanna Wake Word",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Hört auf das Wake Word 'Hey Sanna'"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sanna")
            .setContentText("Hört auf 'Hey Sanna'...")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}

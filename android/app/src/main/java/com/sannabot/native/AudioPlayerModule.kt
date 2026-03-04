package com.sannabot.native

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.AudioManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * AudioPlayerModule – Android MediaPlayer wrapper for audio playback
 *
 * Supports streaming audio from URLs (MP3, M4A, AAC, OGG).
 * Emits events:
 *   - audio_started:  { url }
 *   - audio_paused:   { url, position }
 *   - audio_completed: { url }
 *   - audio_error:    { url, error }
 */
class AudioPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AudioPlayerModule"
    }

    private var mediaPlayer: MediaPlayer? = null
    private var currentUrl: String? = null
    private var isPaused = false

    override fun getName(): String = "AudioPlayerModule"

    // Required by NativeEventEmitter on Android
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    /**
     * Play audio from URL. Stops any currently playing audio.
     */
    @ReactMethod
    fun play(url: String, promise: Promise) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                // Stop current playback if any
                stopCurrent()

                currentUrl = url
                isPaused = false

                android.util.Log.d(TAG, "Playing audio from URL: $url")
                
                // Validate URL before setting data source
                try {
                    val testUrl = URL(url)
                    android.util.Log.d(TAG, "URL scheme: ${testUrl.protocol}, host: ${testUrl.host}")
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "Invalid URL: $url", e)
                    promise.reject("AUDIO_ERROR", "Invalid URL: $url")
                    return@launch
                }

                // Test if URL is reachable on background thread
                val isReachable = withContext(Dispatchers.IO) {
                    try {
                        val connection = URL(url).openConnection() as HttpURLConnection
                        connection.requestMethod = "HEAD"
                        connection.connectTimeout = 5000
                        connection.readTimeout = 5000
                        connection.setRequestProperty("User-Agent", "SannaBot/1.0")
                        connection.connect()
                        val responseCode = connection.responseCode
                        val contentType = connection.getHeaderField("Content-Type")
                        val contentLength = connection.getHeaderField("Content-Length")
                        android.util.Log.d(TAG, "URL test: responseCode=$responseCode, contentType=$contentType, contentLength=$contentLength")
                        connection.disconnect()
                        responseCode in 200..299
                    } catch (e: Exception) {
                        android.util.Log.e(TAG, "URL not reachable: ${e.message}", e)
                        false
                    }
                }

                if (!isReachable) {
                    val errorMsg = "URL is not reachable or server returned error"
                    android.util.Log.e(TAG, errorMsg)
                    promise.reject("AUDIO_ERROR", errorMsg)
                    return@launch
                }

                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .build()
                    )
                    
                    // Let MediaPlayer handle redirects automatically - it supports HTTP redirects natively
                    // MediaPlayer will follow redirects and handle the final URL internally
                    setDataSource(url)
                    prepareAsync()

                    setOnPreparedListener { mp ->
                        android.util.Log.d(TAG, "MediaPlayer prepared successfully")
                        mp.start()
                        sendEvent("audio_started", Arguments.createMap().apply {
                            putString("url", url)
                        })
                        promise.resolve("ok")
                    }

                    setOnCompletionListener {
                        android.util.Log.d(TAG, "Audio playback completed")
                        sendEvent("audio_completed", Arguments.createMap().apply {
                            putString("url", url)
                        })
                        cleanup()
                    }

                    setOnErrorListener { _, what, extra ->
                        // Map error codes to human-readable messages
                        val errorCodeName = when (what) {
                            MediaPlayer.MEDIA_ERROR_UNKNOWN -> "MEDIA_ERROR_UNKNOWN"
                            MediaPlayer.MEDIA_ERROR_SERVER_DIED -> "MEDIA_ERROR_SERVER_DIED"
                            MediaPlayer.MEDIA_ERROR_NOT_VALID_FOR_PROGRESSIVE_PLAYBACK -> "MEDIA_ERROR_NOT_VALID_FOR_PROGRESSIVE_PLAYBACK"
                            MediaPlayer.MEDIA_ERROR_IO -> "MEDIA_ERROR_IO"
                            MediaPlayer.MEDIA_ERROR_MALFORMED -> "MEDIA_ERROR_MALFORMED"
                            MediaPlayer.MEDIA_ERROR_UNSUPPORTED -> "MEDIA_ERROR_UNSUPPORTED"
                            MediaPlayer.MEDIA_ERROR_TIMED_OUT -> "MEDIA_ERROR_TIMED_OUT"
                            else -> "UNKNOWN_ERROR_CODE"
                        }
                        
                        val errorMsg = "MediaPlayer error: $errorCodeName (what=$what, extra=$extra)"
                        android.util.Log.e(TAG, "$errorMsg - URL: $url")
                        
                        sendEvent("audio_error", Arguments.createMap().apply {
                            putString("url", url)
                            putString("error", errorMsg)
                        })
                        cleanup()
                        promise.reject("AUDIO_ERROR", errorMsg)
                        true
                    }
                }
            } catch (e: IOException) {
                val errorMsg = "Failed to prepare audio: ${e.message}"
                android.util.Log.e(TAG, errorMsg, e)
                sendEvent("audio_error", Arguments.createMap().apply {
                    putString("url", url)
                    putString("error", errorMsg)
                })
                cleanup()
                promise.reject("AUDIO_ERROR", errorMsg, e)
            } catch (e: Exception) {
                val errorMsg = "Unexpected error: ${e.message}"
                android.util.Log.e(TAG, errorMsg, e)
                sendEvent("audio_error", Arguments.createMap().apply {
                    putString("url", url)
                    putString("error", errorMsg)
                })
                cleanup()
                promise.reject("AUDIO_ERROR", errorMsg, e)
            }
        }
    }

    /**
     * Pause current playback.
     */
    @ReactMethod
    fun pause(promise: Promise) {
        try {
            val mp = mediaPlayer
            val url = currentUrl
            if (mp != null && mp.isPlaying) {
                val positionMs = mp.currentPosition
                val positionSeconds = positionMs / 1000
                mp.pause()
                isPaused = true
                sendEvent("audio_paused", Arguments.createMap().apply {
                    putString("url", url)
                    putInt("position", positionSeconds)
                })
                promise.resolve(positionSeconds)
            } else {
                promise.resolve(-1)
            }
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to pause: ${e.message}", e)
        }
    }

    /**
     * Resume paused playback.
     */
    @ReactMethod
    fun resume(promise: Promise) {
        try {
            val mp = mediaPlayer
            val url = currentUrl
            if (mp != null && isPaused) {
                mp.start()
                isPaused = false
                sendEvent("audio_started", Arguments.createMap().apply {
                    putString("url", url)
                })
                promise.resolve("ok")
            } else {
                promise.reject("AUDIO_ERROR", "No paused audio to resume")
            }
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to resume: ${e.message}", e)
        }
    }

    /**
     * Stop current playback.
     */
    @ReactMethod
    fun stop(promise: Promise) {
        val url = currentUrl
        stopCurrent()
        if (url != null) {
            sendEvent("audio_stopped", Arguments.createMap().apply {
                putString("url", url)
            })
        }
        promise.resolve("ok")
    }

    /**
     * Seek to position (absolute in seconds, or relative if offset is provided).
     */
    @ReactMethod
    fun seek(positionSeconds: Int, isRelative: Boolean, promise: Promise) {
        try {
            val mp = mediaPlayer ?: run {
                promise.reject("AUDIO_ERROR", "No audio playing")
                return
            }

            val duration = mp.duration
            if (duration <= 0) {
                promise.reject("AUDIO_ERROR", "Duration not available")
                return
            }

            val targetPosition = if (isRelative) {
                val current = mp.currentPosition
                (current / 1000 + positionSeconds).coerceIn(0, duration / 1000) * 1000
            } else {
                positionSeconds.coerceIn(0, duration / 1000) * 1000
            }

            mp.seekTo(targetPosition)
            promise.resolve(targetPosition / 1000)
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to seek: ${e.message}", e)
        }
    }

    /**
     * Get current playback status.
     */
    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val mp = mediaPlayer
            val url = currentUrl

            if (mp == null || url == null) {
                promise.resolve(Arguments.createMap().apply {
                    putString("status", "stopped")
                    putNull("url")
                    putInt("position", 0)
                    putInt("duration", 0)
                })
                return
            }

            val status = when {
                isPaused -> "paused"
                mp.isPlaying -> "playing"
                else -> "stopped"
            }

            promise.resolve(Arguments.createMap().apply {
                putString("status", status)
                putString("url", url)
                putInt("position", mp.currentPosition / 1000) // in seconds
                putInt("duration", if (mp.duration > 0) mp.duration / 1000 else 0) // in seconds
            })
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to get status: ${e.message}", e)
        }
    }

    private fun stopCurrent() {
        try {
            mediaPlayer?.let { mp ->
                if (mp.isPlaying) {
                    mp.stop()
                }
                mp.release()
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error stopping media player", e)
        }
        mediaPlayer = null
        currentUrl = null
        isPaused = false
    }

    private fun cleanup() {
        try {
            mediaPlayer?.release()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error cleaning up media player", e)
        }
        mediaPlayer = null
        currentUrl = null
        isPaused = false
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    /**
     * Follow redirects and get final URL
     * Also validates Content-Type to ensure it's an audio format
     */
    private fun followRedirects(initialUrl: String, maxRedirects: Int = 5): String {
        var currentUrl = initialUrl
        var redirectCount = 0
        
        while (redirectCount < maxRedirects) {
            try {
                val url = URL(currentUrl)
                val connection = url.openConnection() as HttpURLConnection
                
                // Don't follow redirects automatically - we'll do it manually
                connection.instanceFollowRedirects = false
                
                // Add headers
                connection.setRequestProperty("User-Agent", "SannaBot/1.0 (Android; MediaPlayer)")
                connection.setRequestProperty("Accept", "*/*")
                
                connection.connect()
                
                val responseCode = connection.responseCode
                val contentType = connection.getHeaderField("Content-Type")
                val contentLength = connection.getHeaderField("Content-Length")
                
                android.util.Log.d(TAG, "Response: code=$responseCode, Content-Type=$contentType, Content-Length=$contentLength")
                
                // Check for redirects (301, 302, 303, 307, 308)
                if (responseCode in 301..308) {
                    val location = connection.getHeaderField("Location")
                    if (location != null) {
                        currentUrl = if (location.startsWith("http")) {
                            location
                        } else {
                            // Relative URL - resolve against current URL
                            URL(URL(currentUrl), location).toString()
                        }
                        redirectCount++
                        android.util.Log.d(TAG, "Redirect $redirectCount: $currentUrl -> $location")
                        connection.disconnect()
                        continue
                    }
                }
                
                // Final URL reached - validate Content-Type
                if (contentType != null) {
                    val contentTypeLower = contentType.lowercase()
                    val isAudio = contentTypeLower.startsWith("audio/") || 
                                  contentTypeLower.contains("audio") ||
                                  contentTypeLower == "application/octet-stream" ||
                                  contentTypeLower == "binary/octet-stream"
                    
                    if (!isAudio && responseCode == 200) {
                        android.util.Log.w(TAG, "WARNING: Content-Type is not audio: $contentType (URL: $currentUrl)")
                        android.util.Log.w(TAG, "This might cause MEDIA_ERROR_UNSUPPORTED. Content-Type should be audio/mpeg, audio/mp3, audio/mp4, etc.")
                    } else {
                        android.util.Log.d(TAG, "Content-Type validated: $contentType")
                    }
                } else {
                    android.util.Log.w(TAG, "WARNING: No Content-Type header received for URL: $currentUrl")
                }
                
                // No redirect or final URL reached
                connection.disconnect()
                break
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error following redirects: ${e.message}", e)
                break
            }
        }
        
        if (redirectCount > 0) {
            android.util.Log.d(TAG, "Followed $redirectCount redirect(s), final URL: $currentUrl")
        }
        
        return currentUrl
    }


    @Suppress("DEPRECATION")
    override fun onCatalystInstanceDestroy() {
        cleanup()
        super.onCatalystInstanceDestroy()
    }
}

package com.sannabot.native

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL

/**
 * AudioPlayerModule – ExoPlayer wrapper for audio playback
 *
 * Supports streaming audio from URLs (MP3, M4A, AAC, OGG).
 * Emits events:
 *   - audio_started:  { url }
 *   - audio_paused:   { url, position }
 *   - audio_completed: { url }
 *   - audio_error:    { url, error }
 *   - audio_stopped:  { url }
 */
class AudioPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AudioPlayerModule"
    }

    private var exoPlayer: ExoPlayer? = null
    private var currentUrl: String? = null
    private var playerListener: Player.Listener? = null
    
    // Audio Focus
    private var audioFocusRequest: AudioFocusRequest? = null
    private val audioManager: AudioManager
        get() = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    
    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        // ExoPlayer must be accessed on the main thread
        CoroutineScope(Dispatchers.Main).launch {
            when (focusChange) {
                AudioManager.AUDIOFOCUS_GAIN -> {
                    // Audio focus regained - resume playback
                    Log.d(TAG, "Audio focus gained - resuming playback")
                    exoPlayer?.play()
                }
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                    // Temporary loss (e.g., notification, phone call, microphone) - pause
                    Log.d(TAG, "Audio focus lost temporarily - pausing playback")
                    exoPlayer?.pause()
                }
                AudioManager.AUDIOFOCUS_LOSS -> {
                    // Permanent loss (e.g., another app took focus) - stop
                    Log.d(TAG, "Audio focus lost permanently - stopping playback")
                    stopCurrent()
                }
            }
        }
    }

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

                // Request audio focus before playing
                val focusResult = requestAudioFocus()
                if (focusResult != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    val errorMsg = "Could not gain audio focus"
                    Log.e(TAG, errorMsg)
                    promise.reject("AUDIO_ERROR", errorMsg)
                    return@launch
                }

                currentUrl = url
                Log.d(TAG, "Playing audio from URL: $url")

                // Validate URL
                try {
                    val testUrl = URL(url)
                    Log.d(TAG, "URL scheme: ${testUrl.protocol}, host: ${testUrl.host}")
                } catch (e: Exception) {
                    Log.e(TAG, "Invalid URL: $url", e)
                    abandonAudioFocus()
                    promise.reject("AUDIO_ERROR", "Invalid URL: $url")
                    return@launch
                }

                // Track if promise was resolved to avoid resolving twice
                var promiseResolved = false
                
                // Create ExoPlayer instance
                exoPlayer = ExoPlayer.Builder(reactApplicationContext).build().apply {
                    // Create MediaItem from URL
                    val mediaItem = MediaItem.fromUri(url)
                    setMediaItem(mediaItem)
                    
                    // Prepare and play
                    prepare()
                    playWhenReady = true

                    // Add listener for events
                    playerListener = object : Player.Listener {
                        override fun onPlaybackStateChanged(playbackState: Int) {
                            when (playbackState) {
                                Player.STATE_READY -> {
                                    Log.d(TAG, "ExoPlayer ready, playWhenReady=$playWhenReady, isPlaying=$isPlaying")
                                    if (playWhenReady && isPlaying && !promiseResolved) {
                                        Log.d(TAG, "ExoPlayer started successfully")
                                        sendEvent("audio_started", Arguments.createMap().apply {
                                            putString("url", url)
                                        })
                                        promise.resolve("ok")
                                        promiseResolved = true
                                    }
                                }
                                Player.STATE_ENDED -> {
                                    Log.d(TAG, "Audio playback completed")
                                    sendEvent("audio_completed", Arguments.createMap().apply {
                                        putString("url", url)
                                    })
                                    cleanup()
                                }
                                Player.STATE_BUFFERING -> {
                                    Log.d(TAG, "ExoPlayer buffering...")
                                }
                                Player.STATE_IDLE -> {
                                    Log.d(TAG, "ExoPlayer idle")
                                }
                            }
                        }

                        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                            val errorMsg = "ExoPlayer error: ${error.message} (errorCode=${error.errorCode})"
                            Log.e(TAG, "$errorMsg - URL: $url", error)
                            
                            sendEvent("audio_error", Arguments.createMap().apply {
                                putString("url", url)
                                putString("error", errorMsg)
                            })
                            cleanup()
                            if (!promiseResolved) {
                                promise.reject("AUDIO_ERROR", errorMsg)
                                promiseResolved = true
                            }
                        }

                        override fun onIsPlayingChanged(isPlaying: Boolean) {
                            if (isPlaying) {
                                Log.d(TAG, "ExoPlayer started playing")
                                if (!promiseResolved) {
                                    // Player is actually playing now
                                    sendEvent("audio_started", Arguments.createMap().apply {
                                        putString("url", url)
                                    })
                                    promise.resolve("ok")
                                    promiseResolved = true
                                }
                            } else {
                                Log.d(TAG, "ExoPlayer paused or stopped")
                            }
                        }
                    }
                    addListener(playerListener!!)
                }
            } catch (e: Exception) {
                abandonAudioFocus()
                val errorMsg = "Failed to play audio: ${e.message}"
                Log.e(TAG, errorMsg, e)
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
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val player = exoPlayer
                val url = currentUrl
                if (player != null && player.isPlaying) {
                    val positionSeconds = (player.currentPosition / 1000).toInt()
                    player.pause()
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
    }

    /**
     * Resume paused playback.
     */
    @ReactMethod
    fun resume(promise: Promise) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val player = exoPlayer
                val url = currentUrl
                if (player != null && !player.isPlaying) {
                    player.play()
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
    }

    /**
     * Stop current playback.
     */
    @ReactMethod
    fun stop(promise: Promise) {
        CoroutineScope(Dispatchers.Main).launch {
            val url = currentUrl
            stopCurrent()
            if (url != null) {
                sendEvent("audio_stopped", Arguments.createMap().apply {
                    putString("url", url)
                })
            }
            promise.resolve("ok")
        }
    }

    /**
     * Seek to position (absolute in seconds, or relative if offset is provided).
     */
    @ReactMethod
    fun seek(positionSeconds: Int, isRelative: Boolean, promise: Promise) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val player = exoPlayer ?: run {
                    promise.reject("AUDIO_ERROR", "No audio playing")
                    return@launch
                }

                val duration = player.duration
                if (duration <= 0) {
                    promise.reject("AUDIO_ERROR", "Duration not available")
                    return@launch
                }

                val targetPosition = if (isRelative) {
                    val current = player.currentPosition
                    val currentSeconds = current / 1000
                    val durationSeconds = duration / 1000
                    val targetSeconds = (currentSeconds + positionSeconds).coerceIn(0L, durationSeconds)
                    targetSeconds * 1000
                } else {
                    val durationSeconds = duration / 1000
                    val targetSeconds = positionSeconds.toLong().coerceIn(0L, durationSeconds)
                    targetSeconds * 1000
                }

                player.seekTo(targetPosition)
                promise.resolve((targetPosition / 1000).toInt())
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", "Failed to seek: ${e.message}", e)
            }
        }
    }

    /**
     * Get current playback status.
     */
    @ReactMethod
    fun getStatus(promise: Promise) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val player = exoPlayer
                val url = currentUrl

                if (player == null || url == null) {
                    promise.resolve(Arguments.createMap().apply {
                        putString("status", "stopped")
                        putNull("url")
                        putInt("position", 0)
                        putInt("duration", 0)
                    })
                    return@launch
                }

                val status = when {
                    player.isPlaying -> "playing"
                    player.playWhenReady && player.playbackState == Player.STATE_BUFFERING -> "playing"
                    !player.playWhenReady && player.playbackState == Player.STATE_READY -> "paused"
                    else -> "stopped"
                }
                
                Log.d(TAG, "getStatus: status=$status, isPlaying=${player.isPlaying}, playWhenReady=${player.playWhenReady}, playbackState=${player.playbackState}")

                promise.resolve(Arguments.createMap().apply {
                    putString("status", status)
                    putString("url", url)
                    putInt("position", (player.currentPosition / 1000).toInt()) // in seconds
                    putInt("duration", if (player.duration > 0) (player.duration / 1000).toInt() else 0) // in seconds
                })
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", "Failed to get status: ${e.message}", e)
            }
        }
    }

    private fun stopCurrent() {
        try {
            abandonAudioFocus()
            playerListener?.let { listener ->
                exoPlayer?.removeListener(listener)
            }
            exoPlayer?.let { player ->
                if (player.isPlaying) {
                    player.stop()
                }
                player.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping ExoPlayer", e)
        }
        exoPlayer = null
        playerListener = null
        currentUrl = null
    }

    private fun cleanup() {
        try {
            abandonAudioFocus()
            playerListener?.let { listener ->
                exoPlayer?.removeListener(listener)
            }
            exoPlayer?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning up ExoPlayer", e)
        }
        exoPlayer = null
        playerListener = null
        currentUrl = null
    }

    /**
     * Request audio focus for playback.
     * Returns AUDIOFOCUS_REQUEST_GRANTED if successful.
     */
    private fun requestAudioFocus(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Android 8.0+ (API 26+)
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(audioAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(audioFocusChangeListener)
                .build()
            
            audioManager.requestAudioFocus(audioFocusRequest!!)
        } else {
            // Android 7.1 and below
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            )
        }
    }

    /**
     * Abandon audio focus when playback stops.
     */
    private fun abandonAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let {
                    audioManager.abandonAudioFocusRequest(it)
                    audioFocusRequest = null
                }
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(audioFocusChangeListener)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error abandoning audio focus", e)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @Suppress("DEPRECATION")
    override fun onCatalystInstanceDestroy() {
        cleanup()
        super.onCatalystInstanceDestroy()
    }
}

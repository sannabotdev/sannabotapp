package com.sannabot.native

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import android.util.Base64

/**
 * AudioRecorderModule – PCM Audio Streaming to JavaScript
 *
 * Records audio from the microphone and streams PCM chunks to JS via events.
 * Used by WakeWordService and STTService.
 *
 * Events emitted:
 *   - audio_chunk: { data: string (base64 PCM) }
 *   - audio_error: { error: string }
 */
class AudioRecorderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val SAMPLE_RATE = 16000
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        const val FRAME_SIZE = 512 // samples per frame
    }

    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = "AudioRecorderModule"

    // Required by NativeEventEmitter on Android
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    /** Start audio recording and streaming PCM chunks as events */
    @ReactMethod
    fun startRecording(promise: Promise) {
        if (audioRecord != null) {
            promise.reject("ALREADY_RECORDING", "Already recording")
            return
        }

        try {
            val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            val record = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize * 4,
            )

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                promise.reject("INIT_ERROR", "AudioRecord failed to initialize")
                return
            }

            audioRecord = record
            record.startRecording()
            promise.resolve("ok")

            recordingJob = scope.launch {
                val buffer = ShortArray(FRAME_SIZE)
                while (isActive && audioRecord != null) {
                    val read = record.read(buffer, 0, FRAME_SIZE)
                    if (read > 0) {
                        // Convert shorts to bytes and encode as base64
                        val bytes = ByteArray(read * 2)
                        for (i in 0 until read) {
                            bytes[i * 2] = (buffer[i].toInt() and 0xFF).toByte()
                            bytes[i * 2 + 1] = ((buffer[i].toInt() shr 8) and 0xFF).toByte()
                        }
                        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                        sendEvent("audio_chunk", Arguments.createMap().apply {
                            putString("data", base64)
                        })
                    }
                }
            }
        } catch (e: Exception) {
            promise.reject("RECORDING_ERROR", e.message ?: "Unknown error", e)
        }
    }

    /** Stop audio recording */
    @ReactMethod
    fun stopRecording(promise: Promise) {
        recordingJob?.cancel()
        recordingJob = null
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        promise.resolve("ok")
    }

    /** Check if currently recording */
    @ReactMethod
    fun isRecording(promise: Promise) {
        promise.resolve(audioRecord != null && audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING)
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onCatalystInstanceDestroy() {
        recordingJob?.cancel()
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        scope.cancel()
        super.onCatalystInstanceDestroy()
    }
}

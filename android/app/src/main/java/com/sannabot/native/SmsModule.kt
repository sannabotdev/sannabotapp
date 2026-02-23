package com.sannabot.native

import android.telephony.SmsManager
import com.facebook.react.bridge.*

/**
 * SmsModule – Send SMS directly without opening the SMS app.
 *
 * Uses Android's SmsManager to send text messages in the background.
 * Requires android.permission.SEND_SMS (runtime permission).
 *
 * For long messages (>160 chars) it automatically uses multipart sending.
 */
class SmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsModule"

    /**
     * Send an SMS directly.
     *
     * @param phoneNumber  Destination phone number (e.g. "+4366012345678")
     * @param message      The text message to send
     * @param promise      Resolves with "ok" or rejects with error
     */
    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()

            // Handle long messages (>160 chars) by splitting into parts
            if (message.length > 160) {
                val parts = smsManager.divideMessage(message)
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            }

            promise.resolve("ok")
        } catch (e: Exception) {
            promise.reject("SMS_ERROR", e.message ?: "SMS senden fehlgeschlagen", e)
        }
    }
}

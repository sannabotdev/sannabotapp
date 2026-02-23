package com.sannabot.native

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.provider.CallLog
import android.provider.ContactsContract
import android.provider.Telephony
import com.facebook.react.bridge.*

/**
 * DeviceQueryModule – Local device data queries via Android ContentResolver
 *
 * Provides access to:
 *   - Contacts (name, phone numbers)
 *   - SMS inbox
 *   - Call log
 *
 * No internet required. All data stays on-device.
 */
class DeviceQueryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DeviceQueryModule"

    private val contentResolver: ContentResolver
        get() = reactApplicationContext.contentResolver

    // ─── Battery ──────────────────────────────────────────────────────────────

    /**
     * Returns battery charge level as a float 0.0–1.0.
     * Uses Android BatteryManager.BATTERY_PROPERTY_CAPACITY (API 21+).
     */
    @ReactMethod
    fun getBatteryLevel(promise: Promise) {
        try {
            val bm = reactApplicationContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            promise.resolve(pct / 100.0)
        } catch (e: Exception) {
            promise.reject("BATTERY_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ─── WiFi ─────────────────────────────────────────────────────────────────

    /**
     * Returns WiFi connection status, SSID and signal level.
     * Resolves a map: { connected: Boolean, ssid?: String, rssi?: Int, signalLevel?: Int (0–4) }
     */
    @ReactMethod
    fun getWifiStatus(promise: Promise) {
        try {
            val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val wifiManager = reactApplicationContext.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as WifiManager

            val isWifiConnected: Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val caps = cm.getNetworkCapabilities(cm.activeNetwork)
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
            } else {
                @Suppress("DEPRECATION")
                cm.activeNetworkInfo?.type == ConnectivityManager.TYPE_WIFI &&
                    cm.activeNetworkInfo?.isConnected == true
            }

            val result = WritableNativeMap()
            result.putBoolean("connected", isWifiConnected)

            if (isWifiConnected) {
                @Suppress("DEPRECATION")
                val info = wifiManager.connectionInfo
                val rawSsid = info?.ssid ?: ""
                val ssid = rawSsid.removePrefix("\"").removeSuffix("\"")
                val rssi = info?.rssi ?: -100
                val level = WifiManager.calculateSignalLevel(rssi, 5) // 0–4
                result.putString("ssid", ssid)
                result.putInt("rssi", rssi)
                result.putInt("signalLevel", level)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("WIFI_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ─── Contacts ─────────────────────────────────────────────────────────────

    /**
     * Search contacts by name.
     * @param query  Name to search (partial match)
     * @param limit  Max results (default 10)
     */
    @ReactMethod
    fun searchContacts(query: String, limit: Int, promise: Promise) {
        try {
            val results = WritableNativeArray()
            val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.TYPE,
            )
            val selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?"
            val selectionArgs = arrayOf("%$query%")
            val sortOrder = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC LIMIT $limit"

            val cursor: Cursor? = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
            cursor?.use {
                while (it.moveToNext()) {
                    val contact = WritableNativeMap().apply {
                        putString("name", it.getString(0) ?: "")
                        putString("number", it.getString(1) ?: "")
                        putInt("type", it.getInt(2))
                    }
                    results.pushMap(contact)
                }
            }
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("CONTACTS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    /**
     * Get all phone numbers for a specific contact name.
     */
    @ReactMethod
    fun getContactNumbers(name: String, promise: Promise) {
        try {
            val results = WritableNativeArray()
            val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.TYPE,
            )
            val selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} = ?"
            val selectionArgs = arrayOf(name)

            val cursor = contentResolver.query(uri, projection, selection, selectionArgs, null)
            cursor?.use {
                while (it.moveToNext()) {
                    val entry = WritableNativeMap().apply {
                        putString("name", it.getString(0) ?: "")
                        putString("number", it.getString(1) ?: "")
                        putInt("type", it.getInt(2))
                    }
                    results.pushMap(entry)
                }
            }
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("CONTACTS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ─── SMS ──────────────────────────────────────────────────────────────────

    /**
     * Get recent SMS messages from inbox.
     * @param limit Max messages to return (default 10)
     */
    @ReactMethod
    fun getRecentSMS(limit: Int, promise: Promise) {
        try {
            val results = WritableNativeArray()
            val uri = Telephony.Sms.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE,
            )
            val sortOrder = "${Telephony.Sms.DATE} DESC LIMIT $limit"

            val cursor = contentResolver.query(uri, projection, null, null, sortOrder)
            cursor?.use {
                while (it.moveToNext()) {
                    val sms = WritableNativeMap().apply {
                        putString("address", it.getString(0) ?: "")
                        putString("body", it.getString(1) ?: "")
                        putDouble("date", it.getLong(2).toDouble())
                        putInt("type", it.getInt(3)) // 1=inbox, 2=sent
                    }
                    results.pushMap(sms)
                }
            }
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("SMS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    /**
     * Search SMS by sender address or body content.
     */
    @ReactMethod
    fun searchSMS(query: String, limit: Int, promise: Promise) {
        try {
            val results = WritableNativeArray()
            val uri = Telephony.Sms.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE,
            )
            val selection = "${Telephony.Sms.BODY} LIKE ? OR ${Telephony.Sms.ADDRESS} LIKE ?"
            val selectionArgs = arrayOf("%$query%", "%$query%")
            val sortOrder = "${Telephony.Sms.DATE} DESC LIMIT $limit"

            val cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
            cursor?.use {
                while (it.moveToNext()) {
                    val sms = WritableNativeMap().apply {
                        putString("address", it.getString(0) ?: "")
                        putString("body", it.getString(1) ?: "")
                        putDouble("date", it.getLong(2).toDouble())
                        putInt("type", it.getInt(3))
                    }
                    results.pushMap(sms)
                }
            }
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("SMS_ERROR", e.message ?: "Unknown error", e)
        }
    }

    // ─── Call Log ─────────────────────────────────────────────────────────────

    /**
     * Get recent call log entries.
     * @param limit Max entries (default 10)
     */
    @ReactMethod
    fun getRecentCalls(limit: Int, promise: Promise) {
        try {
            val results = WritableNativeArray()
            val uri = CallLog.Calls.CONTENT_URI
            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE, // 1=incoming, 2=outgoing, 3=missed
            )
            val sortOrder = "${CallLog.Calls.DATE} DESC LIMIT $limit"

            val cursor = contentResolver.query(uri, projection, null, null, sortOrder)
            cursor?.use {
                while (it.moveToNext()) {
                    val callTypeStr = when (it.getInt(4)) {
                        CallLog.Calls.INCOMING_TYPE -> "incoming"
                        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                        CallLog.Calls.MISSED_TYPE -> "missed"
                        else -> "unknown"
                    }
                    val call = WritableNativeMap().apply {
                        putString("number", it.getString(0) ?: "")
                        putString("name", it.getString(1) ?: "")
                        putDouble("date", it.getLong(2).toDouble())
                        putInt("duration", it.getInt(3))
                        putString("type", callTypeStr)
                    }
                    results.pushMap(call)
                }
            }
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("CALLLOG_ERROR", e.message ?: "Unknown error", e)
        }
    }
}

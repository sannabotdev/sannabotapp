/**
 * DeviceTool – Query and control device functions
 *
 * GPS location, battery, volume, Bluetooth, WLAN, system time
 */
import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';

// Use Google Play Services Fused Location Provider instead of the old
// Android LocationManager – much more reliable, works indoors via Wi-Fi/cell.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true, // we handle permissions ourselves
  locationProvider: 'playServices',
});

const { VolumeManager, DeviceQueryModule } = NativeModules;

type DeviceAction =
  | 'get_location'
  | 'get_battery'
  | 'get_time'
  | 'get_volume'
  | 'set_volume'
  | 'get_wifi_status'
  | 'encode_base64url'
  | 'get_date_timestamp';

export class DeviceTool implements Tool {
  name(): string {
    return 'device';
  }

  description(): string {
    return 'Query and control device state: GPS location, battery level, time, volume (read/set), Wi-Fi status. Calculate Unix timestamps for dates (today, yesterday, tomorrow, or YYYY-MM-DD).';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get_location', 'get_battery', 'get_time', 'get_volume', 'set_volume', 'get_wifi_status', 'encode_base64url', 'get_date_timestamp'],
          description: 'Action to perform. set_volume: set media volume (0–100). encode_base64url: encode text as base64url (UTF-8) for the Gmail API. get_date_timestamp: calculate Unix timestamp for a date.',
        },
        volume: {
          type: 'number',
          description: 'Only for set_volume: desired volume in percent (0–100).',
        },
        text: {
          type: 'string',
          description: 'Only for encode_base64url: the text to encode (e.g. an RFC 2822 email).',
        },
        date: {
          type: 'string',
          description: 'Only for get_date_timestamp: date specification. Can be "today", "yesterday", "tomorrow", or a date in YYYY-MM-DD format.',
        },
        time: {
          type: 'string',
          description: 'Only for get_date_timestamp: time specification in HH:MM:SS format (default: "00:00:00" for midnight).',
        },
        unit: {
          type: 'string',
          enum: ['seconds', 'milliseconds'],
          description: 'Only for get_date_timestamp: return timestamp in "seconds" or "milliseconds" (default: "seconds").',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as DeviceAction;

    try {
      switch (action) {
        case 'get_location':
          return this.getLocation();
        case 'get_battery':
          return this.getBattery();
        case 'get_time':
          return this.getTime();
        case 'get_volume':
          return this.getVolume();
        case 'set_volume':
          return this.setVolume(args.volume as number);
        case 'get_wifi_status':
          return await this.getWifiStatus();
        case 'encode_base64url':
          return this.encodeBase64url(args.text as string);
        case 'get_date_timestamp':
          return this.getDateTimestamp(
            args.date as string,
            args.time as string | undefined,
            args.unit as 'seconds' | 'milliseconds' | undefined,
          );
        default:
          return errorResult(`Unknown action: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Device query failed: ${message}`);
    }
  }

  private async getLocation(): Promise<ToolResult> {
    // Request runtime permission first (Android)
    let fineGranted = true;
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'GPS permission',
          message: 'Sanna needs access to your location.',
          buttonPositive: 'Erlauben',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        // Fine location denied – try coarse (network-based) location
        const coarseGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        );
        if (coarseGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          return errorResult('Location permission denied');
        }
        fineGranted = false;
      }
    }

    // If only coarse permission → skip GPS, go straight to network
    if (!fineGranted) {
      return this.getPositionWithAccuracy(false);
    }

    // Try GPS first, fall back to network-based (approximate) location on failure
    const gpsResult = await this.getPositionWithAccuracy(true);
    if (!gpsResult.isError) {
      return gpsResult;
    }
    return this.getPositionWithAccuracy(false);
  }

  private getPositionWithAccuracy(highAccuracy: boolean): Promise<ToolResult> {
    const timeoutMs = highAccuracy ? 12000 : 8000;

    return new Promise(resolve => {
      const timer = setTimeout(() => {
        resolve(errorResult(
          highAccuracy
            ? 'GPS timeout – no signal'
            : 'Network location timeout – no signal',
        ));
      }, timeoutMs + 3000);

      Geolocation.getCurrentPosition(
        pos => {
          clearTimeout(timer);
          const { latitude, longitude, accuracy } = pos.coords;
          if (highAccuracy) {
            resolve(
              successResult(
                `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (accuracy: ${accuracy?.toFixed(0) ?? '?'}m)`,
                `Position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              ),
            );
          } else {
            resolve(
              successResult(
                `Approximate location (network-based, not GPS): ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (accuracy: ~${accuracy?.toFixed(0) ?? '?'}m)`,
                `Approximate position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              ),
            );
          }
        },
        err => {
          clearTimeout(timer);
          resolve(errorResult(
            highAccuracy
              ? `GPS error: ${err.message}`
              : `Network location error: ${err.message}`,
          ));
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: highAccuracy ? 60000 : 300000,
        },
      );
    });
  }

  private async getBattery(): Promise<ToolResult> {
    try {
      if (DeviceQueryModule?.getBatteryLevel) {
        const level: number = await DeviceQueryModule.getBatteryLevel();
        const percent = Math.round(level * 100);
        return successResult(`Battery: ${percent}%`);
      }
      return successResult('Battery: not available');
    } catch (err) {
      return errorResult(`Battery query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private getTime(): ToolResult {
    const now = new Date();
    const nowMs = now.getTime();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    // ISO date (YYYY-MM-DD) for precise date arithmetic (avoids off-by-one errors)
    const isoDate = now.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
    // No forUser: the LLM uses this result internally.
    // If the user explicitly asks for the time, the LLM should use the tts tool.
    // This prevents the time from being auto-spoken as an intermediate step in driving mode.
    return successResult(
      `Time: ${timeStr}, Date: ${dateStr}, ISO-Date: ${isoDate}, ` +
      `Today is ${dateStr} (${isoDate}), ` +
      `now_ms: ${nowMs} (Unix timestamp in milliseconds – for scheduler trigger_at_ms: simply calculate now_ms + desired duration in ms)`,
    );
  }

  private async getVolume(): Promise<ToolResult> {
    try {
      if (VolumeManager) {
        const volume: number = await VolumeManager.getVolume();
        const percent = Math.round(volume * 100);
        return successResult(`Volume: ${percent}%`);
      }
      return successResult('Volume: not available (VolumeManager missing)');
    } catch (err) {
      return errorResult(`Volume query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async setVolume(percent: number): Promise<ToolResult> {
    try {
      if (typeof percent !== 'number' || isNaN(percent)) {
        return errorResult('set_volume: "volume" parameter missing or invalid.');
      }
      if (!VolumeManager) {
        return errorResult('Volume: not available (VolumeManager missing)');
      }
      const clamped = Math.max(0, Math.min(100, percent));
      const level = clamped / 100; // 0.0–1.0
      const actual: number = await VolumeManager.setVolume(level);
      const actualPercent = Math.round(actual * 100);
      return successResult(
        `Volume set to ${actualPercent}%`,
        `Volume ${actualPercent}%`,
      );
    } catch (err) {
      return errorResult(`Set volume failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async getWifiStatus(): Promise<ToolResult> {
    try {
      if (!DeviceQueryModule?.getWifiStatus) {
        return errorResult('Wi-Fi status not available (DeviceQueryModule missing)');
      }
      const status: { connected: boolean; ssid?: string; rssi?: number; signalLevel?: number } =
        await DeviceQueryModule.getWifiStatus();

      if (!status.connected) {
        return successResult('Wi-Fi: not connected');
      }

      const levelLabels = ['very weak', 'weak', 'fair', 'good', 'excellent'];
      const signalStr = status.signalLevel != null ? (levelLabels[status.signalLevel] ?? 'unknown') : 'unknown';
      return successResult(
        `Wi-Fi connected: ${status.ssid ?? 'unknown'}, signal: ${signalStr} (${status.rssi ?? '?'} dBm)`,
      );
    } catch (err) {
      return errorResult(
        `Wi-Fi status query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private encodeBase64url(text: string): ToolResult {
    if (typeof text !== 'string' || text.length === 0) {
      return errorResult('encode_base64url: "text" parameter missing or empty.');
    }
    try {
      // encodeURIComponent → percent-encodes every non-ASCII byte
      // unescape converts %XX back to single-byte chars (latin-1 view of UTF-8 bytes)
      // btoa can then safely base64-encode the byte string
      // This is the standard Hermes/React-Native-safe UTF-8 → base64 trick
      const utf8Bytes = unescape(encodeURIComponent(text));
      const base64 = btoa(utf8Bytes);
      const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return successResult(base64url);
    } catch (err) {
      return errorResult(`base64url encoding failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private getDateTimestamp(
    date: string,
    time?: string,
    unit: 'seconds' | 'milliseconds' = 'seconds',
  ): ToolResult {
    if (!date || typeof date !== 'string') {
      return errorResult('get_date_timestamp: "date" parameter is required.');
    }

    try {
      const now = new Date();
      let targetDate: Date;

      // Parse date specification
      if (date === 'today') {
        targetDate = new Date(now);
      } else if (date === 'yesterday') {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - 1);
      } else if (date === 'tomorrow') {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 1);
      } else {
        // Try to parse as YYYY-MM-DD
        const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
          return errorResult(`get_date_timestamp: invalid date format. Use "today", "yesterday", "tomorrow", or YYYY-MM-DD.`);
        }
        const [, year, month, day] = dateMatch;
        targetDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      }

      // Parse time specification (default: midnight 00:00:00)
      const timeStr = time || '00:00:00';
      const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!timeMatch) {
        return errorResult(`get_date_timestamp: invalid time format. Use HH:MM:SS or HH:MM.`);
      }
      const [, hours, minutes, seconds = '0'] = timeMatch;
      targetDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10), 0);

      // Calculate timestamp
      const timestampMs = targetDate.getTime();
      const timestamp = unit === 'seconds' ? Math.floor(timestampMs / 1000) : timestampMs;

      const dateStr = targetDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const timeStrFormatted = targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      return successResult(
        `${timestamp}`,
        `Unix timestamp (${unit}): ${timestamp} for ${dateStr} ${timeStrFormatted}`,
      );
    } catch (err) {
      return errorResult(`get_date_timestamp failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

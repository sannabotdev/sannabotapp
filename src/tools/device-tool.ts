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
  | 'get_volume'
  | 'set_volume'
  | 'get_wifi_status'
  | 'calculate_distance';

export class DeviceTool implements Tool {
  name(): string {
    return 'device';
  }

  description(): string {
    return 'Query and control device state: GPS location, battery level, volume (read/set), Wi-Fi status. Also calculates straight-line distance between two GPS coordinates using the Haversine formula.';
  }

  systemHint(): string {
    return 'Fetch GPS location before weather or navigation requests. Check battery/Wi-Fi when the user asks about phone status.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get_location', 'get_battery', 'get_volume', 'set_volume', 'get_wifi_status', 'calculate_distance'],
          description: 'Action to perform. set_volume: set media volume (0–100). calculate_distance: calculate straight-line distance between two GPS coordinates.',
        },
        volume: {
          type: 'number',
          description: 'Only for set_volume: desired volume in percent (0–100).',
        },
        latitude1: {
          type: 'number',
          description: 'Only for calculate_distance: latitude of first point (e.g., 48.1234).',
        },
        longitude1: {
          type: 'number',
          description: 'Only for calculate_distance: longitude of first point (e.g., 16.5678).',
        },
        latitude2: {
          type: 'number',
          description: 'Only for calculate_distance: latitude of second point (e.g., 48.0600).',
        },
        longitude2: {
          type: 'number',
          description: 'Only for calculate_distance: longitude of second point (e.g., 16.0840).',
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
        case 'get_volume':
          return this.getVolume();
        case 'set_volume':
          return this.setVolume(args.volume as number);
        case 'get_wifi_status':
          return await this.getWifiStatus();
        case 'calculate_distance':
          return this.calculateDistance(
            args.latitude1 as number,
            args.longitude1 as number,
            args.latitude2 as number,
            args.longitude2 as number,
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
      // Check first (works without Activity / in headless mode)
      const fineAlready = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (fineAlready) {
        fineGranted = true;
      } else {
        // Try to request via dialog – this needs an Activity.
        // In headless / background mode the call throws, so we catch it.
        try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'GPS permission',
          message: 'Sanna needs access to your location.',
          buttonPositive: 'Erlauben',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            fineGranted = false;
          }
        } catch {
          // No Activity – request dialog impossible. Permission stays denied.
          fineGranted = false;
        }

        if (!fineGranted) {
          // Try coarse location
          const coarseAlready = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          );
          if (!coarseAlready) {
            try {
        const coarseGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        );
        if (coarseGranted !== PermissionsAndroid.RESULTS.GRANTED) {
                return errorResult('Location permission denied. Cannot get GPS coordinates or calculate distance without location permission. Please grant location permission while the app is in the foreground.');
        }
            } catch {
              return errorResult('Location permission not granted and cannot be requested in background mode. Please grant location permission while the app is in the foreground.');
            }
          }
          // coarseAlready === true → proceed with coarse
        }
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
            ? 'GPS timeout – no signal. Location unavailable. Cannot calculate distance without valid GPS coordinates.'
            : 'Network location timeout – no signal. Location unavailable. Cannot calculate distance without valid GPS coordinates.',
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
              ? `GPS error: ${err.message}. Location unavailable. Cannot calculate distance without valid GPS coordinates.`
              : `Network location error: ${err.message}. Location unavailable. Cannot calculate distance without valid GPS coordinates.`,
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

  /**
   * Calculate straight-line distance between two GPS coordinates using Haversine formula.
   * Returns distance in kilometers.
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): ToolResult {
    // Explicitly check for null/undefined first
    if (
      lat1 == null ||
      lon1 == null ||
      lat2 == null ||
      lon2 == null ||
      typeof lat1 !== 'number' ||
      typeof lon1 !== 'number' ||
      typeof lat2 !== 'number' ||
      typeof lon2 !== 'number' ||
      isNaN(lat1) ||
      isNaN(lon1) ||
      isNaN(lat2) ||
      isNaN(lon2)
    ) {
      return errorResult(
        'calculate_distance: All four parameters (latitude1, longitude1, latitude2, longitude2) are required and must be valid numbers. GPS location may have failed - ensure get_location succeeded before calculating distance.',
      );
    }

    // Validate latitude range [-90, 90]
    if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
      return errorResult('calculate_distance: Latitude must be between -90 and 90 degrees.');
    }

    // Validate longitude range [-180, 180]
    if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
      return errorResult('calculate_distance: Longitude must be between -180 and 180 degrees.');
    }

    // Haversine formula
    const R = 6371; // Earth radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    const distanceKm = distance.toFixed(2);
    const distanceMeters = Math.round(distance * 1000);

    return successResult(
      `Distance: ${distanceKm} km (${distanceMeters} m)`,
      `${distanceKm} km`,
    );
  }
}

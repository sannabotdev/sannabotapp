/**
 * PermissionManager – Android Runtime Permissions per Skill
 *
 * Reads the permissions array from SKILL.md frontmatter and requests
 * the necessary Android runtime permissions.
 */
import { PermissionsAndroid, Permission, PermissionStatus } from 'react-native';

// Map from skill permission names (may be shorthand) to Android permission strings
const PERMISSION_MAP: Record<string, Permission> = {
  'android.permission.RECORD_AUDIO': PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  'android.permission.ACCESS_FINE_LOCATION': PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  'android.permission.ACCESS_COARSE_LOCATION': PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  'android.permission.READ_CONTACTS': PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  'android.permission.READ_SMS': PermissionsAndroid.PERMISSIONS.READ_SMS,
  'android.permission.SEND_SMS': PermissionsAndroid.PERMISSIONS.SEND_SMS,
  'android.permission.READ_CALL_LOG': PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
  'android.permission.CALL_PHONE': PermissionsAndroid.PERMISSIONS.CALL_PHONE,
  'android.permission.CAMERA': PermissionsAndroid.PERMISSIONS.CAMERA,
  'android.permission.INTERNET': null as unknown as Permission, // Granted at install time
};

export interface PermissionResult {
  permission: string;
  status: 'granted' | 'denied' | 'never_ask_again' | 'unavailable';
}

export interface PermissionCheckResult {
  allGranted: boolean;
  results: PermissionResult[];
  missing: string[];
}

export class PermissionManager {
  /**
   * Check which permissions are granted without requesting them.
   */
  async checkPermissions(permissions: string[]): Promise<PermissionCheckResult> {
    const results: PermissionResult[] = [];
    const missing: string[] = [];

    for (const perm of permissions) {
      const androidPerm = PERMISSION_MAP[perm];

      // Install-time permissions (INTERNET etc.) are always granted
      if (!androidPerm) {
        results.push({ permission: perm, status: 'granted' });
        continue;
      }

      const status = await PermissionsAndroid.check(androidPerm);
      const mapped: PermissionResult['status'] = status ? 'granted' : 'denied';
      results.push({ permission: perm, status: mapped });
      if (!status) {
        missing.push(perm);
      }
    }

    return {
      allGranted: missing.length === 0,
      results,
      missing,
    };
  }

  /**
   * Request all missing permissions from the given list.
   * Returns the combined result of check + request.
   */
  async ensurePermissions(permissions: string[]): Promise<PermissionCheckResult> {
    if (permissions.length === 0) {
      return { allGranted: true, results: [], missing: [] };
    }

    const androidPerms = permissions
      .map(p => PERMISSION_MAP[p])
      .filter((p): p is Permission => p !== null && p !== undefined);

    if (androidPerms.length === 0) {
      // All install-time permissions
      return { allGranted: true, results: permissions.map(p => ({ permission: p, status: 'granted' as const })), missing: [] };
    }

    const statuses = await PermissionsAndroid.requestMultiple(androidPerms);

    const results: PermissionResult[] = [];
    const missing: string[] = [];

    for (const perm of permissions) {
      const androidPerm = PERMISSION_MAP[perm];
      if (!androidPerm) {
        results.push({ permission: perm, status: 'granted' });
        continue;
      }

      const status = statuses[androidPerm] as PermissionStatus;
      let mapped: PermissionResult['status'];
      switch (status) {
        case PermissionsAndroid.RESULTS.GRANTED:
          mapped = 'granted';
          break;
        case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
          mapped = 'never_ask_again';
          missing.push(perm);
          break;
        default:
          mapped = 'denied';
          missing.push(perm);
      }
      results.push({ permission: perm, status: mapped });
    }

    return {
      allGranted: missing.length === 0,
      results,
      missing,
    };
  }

  /** Check a single permission */
  async isGranted(permission: string): Promise<boolean> {
    const androidPerm = PERMISSION_MAP[permission];
    if (!androidPerm) return true; // Install-time permission
    return PermissionsAndroid.check(androidPerm);
  }
}

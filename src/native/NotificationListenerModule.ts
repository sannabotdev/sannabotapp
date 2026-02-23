/**
 * TypeScript bridge for NotificationListenerModule native module
 *
 * Provides access to Android NotificationListenerService functionality:
 * - Check if notification access is granted
 * - Open notification access settings
 * - Manage subscribed apps (allowlist)
 * - Retrieve buffered notifications
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { NotificationListenerModule } = NativeModules;

export interface NotificationListenerModuleType {
  /** Check if notification access is granted */
  isNotificationAccessGranted(): Promise<boolean>;

  /** Open Android's Notification Access settings page */
  openNotificationAccessSettings(): Promise<string>;

  /** Get list of subscribed app package names (JSON array string) */
  getSubscribedApps(): Promise<string>;

  /** Set list of subscribed app package names (JSON array string) */
  setSubscribedApps(json: string): Promise<string>;

  /** Get recent buffered notifications (JSON array string) */
  getRecentNotifications(): Promise<string>;

  /** Clear the notification buffer */
  clearNotifications(): Promise<string>;
}

export interface NotificationData {
  packageName: string;
  title: string;
  text: string;
  sender: string;
  timestamp: number;
  key: string;
}

const module = NotificationListenerModule as NotificationListenerModuleType | undefined;

/**
 * Get the NotificationListenerModule instance.
 * Returns undefined on non-Android platforms.
 */
export function getNotificationListenerModule(): NotificationListenerModuleType | undefined {
  if (Platform.OS !== 'android' || !module) {
    return undefined;
  }
  return module;
}

/**
 * Create an event emitter for notification events.
 * Subscribe to 'onNotification' events to receive real-time notifications.
 */
export function createNotificationEventEmitter(): NativeEventEmitter | undefined {
  if (Platform.OS !== 'android' || !module) {
    return undefined;
  }
  return new NativeEventEmitter(module as any);
}

export default module as NotificationListenerModuleType | undefined;

/**
 * bring-to-foreground – Shared helper for all headless tasks.
 *
 * Brings SannaBot's Activity to the foreground via an ACTION_MAIN Intent.
 * Skips the Intent if the app is already active – avoids an unnecessary
 * background→foreground cycle that would trigger the vault re-lock.
 * When skipped the polling interval in App.tsx will pick up pending messages
 * from ConversationStore within a few seconds.
 *
 * Non-fatal: errors are logged but never thrown.
 */
import { AppState } from 'react-native';
import IntentModule from '../native/IntentModule';
import { DebugLogger } from './debug-logger';

/**
 * Bring SannaBot's Activity to the foreground.
 *
 * @param tag  Log tag for DebugLogger (e.g. 'Scheduler', 'AccessibilityTask')
 */
export async function bringToForeground(tag: string): Promise<void> {
  if (AppState.currentState === 'active') {
    // App is already visible – the polling interval in App.tsx will pick up
    // pending messages within a few seconds. No Intent needed.
    DebugLogger.add('info', tag, 'App already active – skipping bringToForeground Intent');
    return;
  }
  try {
    await IntentModule.sendIntent('android.intent.action.MAIN', null, 'com.sannabot', null);
  } catch (err) {
    DebugLogger.add('error', tag, `Could not bring app to foreground: ${err}`);
  }
}

/**
 * @format
 */

// Polyfill setImmediate – removed in RN 0.84 but still used by some libraries
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

import './global.css';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// ─── Global crash & rejection handlers ──────────────────────────────────────
// Always write to the log file (writeSystemLog bypasses the enabled flag)
// so fatal errors are captured even when debug logging is off.
import { DebugFileLogger } from './src/agent/debug-file-logger';

// Catch unhandled JS exceptions (crashes)
const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  try {
    const tag = isFatal ? 'FATAL' : 'ERROR';
    const msg = error instanceof Error
      ? `${error.message}\n${error.stack ?? ''}`
      : String(error);
    DebugFileLogger.writeSystemLog(tag, `💥 Unhandled JS exception: ${msg}`);
  } catch {
    // Must not throw inside the crash handler
  }
  // Forward to the default handler so React Native can show the red screen / crash
  if (defaultHandler) {
    defaultHandler(error, isFatal);
  }
});

// Catch unhandled promise rejections
if (typeof global !== 'undefined') {
  const orig = global.onunhandledrejection;
  global.onunhandledrejection = (event) => {
    try {
      const reason = event?.reason;
      const msg = reason instanceof Error
        ? `${reason.message}\n${reason.stack ?? ''}`
        : String(reason);
      DebugFileLogger.writeSystemLog('ERROR', `⚠️ Unhandled promise rejection: ${msg}`);
    } catch {
      // Must not throw
    }
    if (typeof orig === 'function') {
      orig(event);
    }
  };
}

AppRegistry.registerComponent(appName, () => App);
DebugFileLogger.writeSystemLog('LIFECYCLE', '🚀 JS runtime started');

// Register the headless task for scheduled sub-agent execution.
// When an alarm fires and the app is in the background, Android starts
// a HeadlessJsTaskService which runs this task in a background JS thread.
AppRegistry.registerHeadlessTask(
  'SannaSchedulerTask',
  () => require('./src/agent/scheduler-headless').default,
);

// Register the headless task for accessibility UI automation.
// Started by AccessibilityJobModule.startJob() before the target app opens.
// Runs in its own JS context – NOT throttled when SannaBot is in the background.
AppRegistry.registerHeadlessTask(
  'SannaAccessibilityTask',
  () => require('./src/agent/accessibility-headless-task').default,
);

// Register the headless task for notification sub-agent processing.
// Started directly by SannaNotificationListenerService (native) when a notification
// from a subscribed app arrives.  Runs completely in the background.
AppRegistry.registerHeadlessTask(
  'SannaNotificationTask',
  () => require('./src/agent/notification-headless').default,
);

// Register the headless task for timer expiration message formatting.
// When a timer expires, TimerReceiver starts this task to format a user-friendly
// message via LLM using formulateResponse.
AppRegistry.registerHeadlessTask(
  'SannaTimerTask',
  () => require('./src/agent/timer-headless').default,
);

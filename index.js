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

AppRegistry.registerComponent(appName, () => App);

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

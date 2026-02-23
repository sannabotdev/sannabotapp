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

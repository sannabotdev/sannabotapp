/**
 * KeepAwakeModule – JS wrapper for the native KeepAwakeModule.
 *
 * Prevents the Android screen from dimming / going to standby.
 * Uses FLAG_KEEP_SCREEN_ON on the Activity window (no extra permission needed).
 *
 * Usage:
 *   import KeepAwakeModule from './src/native/KeepAwakeModule';
 *   KeepAwakeModule.activate();   // keep screen on
 *   KeepAwakeModule.deactivate(); // restore normal screen behaviour
 */
import { NativeModules, Platform } from 'react-native';

interface IKeepAwakeModule {
  activate(): void;
  deactivate(): void;
}

// Graceful no-op on iOS (or any platform where the module is absent)
const noop = () => {};
const noopModule: IKeepAwakeModule = { activate: noop, deactivate: noop };

const KeepAwakeModule: IKeepAwakeModule =
  Platform.OS === 'android' && NativeModules.KeepAwakeModule
    ? (NativeModules.KeepAwakeModule as IKeepAwakeModule)
    : noopModule;

export default KeepAwakeModule;

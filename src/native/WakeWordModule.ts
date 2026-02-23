/**
 * TypeScript bridge for WakeWordModule native module
 */
import { NativeModules, NativeEventEmitter } from 'react-native';

const { WakeWordModule } = NativeModules;

export interface WakeWordModuleType {
  startListening(accessKey: string, keywordPath: string | null): Promise<string>;
  stopListening(): Promise<string>;
}

export const WakeWordEvents = new NativeEventEmitter(WakeWordModule);

export default WakeWordModule as WakeWordModuleType;

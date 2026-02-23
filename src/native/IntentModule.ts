/**
 * TypeScript bridge for IntentModule native module
 */
import { NativeModules } from 'react-native';

const { IntentModule } = NativeModules;

export interface IntentModuleType {
  sendIntent(
    action: string,
    uri: string | null,
    packageName: string | null,
    extras: Record<string, string | number | boolean> | null,
  ): Promise<string>;
  isAppInstalled(packageName: string): Promise<boolean>;
}

export default IntentModule as IntentModuleType;

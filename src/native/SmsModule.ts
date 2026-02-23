/**
 * TypeScript bridge for SmsModule native module
 *
 * Sends SMS directly via Android SmsManager (no UI interaction needed).
 */
import { NativeModules } from 'react-native';

const { SmsModule } = NativeModules;

export interface SmsModuleType {
  sendSms(phoneNumber: string, message: string): Promise<string>;
}

export default SmsModule as SmsModuleType;

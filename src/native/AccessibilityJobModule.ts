import { NativeModules } from 'react-native';

export interface AccessibilityJobModuleType {
  /**
   * Start the AccessibilityHeadlessService with the given job JSON.
   * The HeadlessJS task (SannaAccessibilityTask) runs the automation
   * in a separate JS context – JS stays alive even when SannaBot is in background.
   */
  startJob(jobJson: string): Promise<void>;
}

const AccessibilityJobModule =
  NativeModules.AccessibilityJobModule as AccessibilityJobModuleType;

export default AccessibilityJobModule;

/**
 * TypeScript bridge for AccessibilityModule native module
 *
 * Provides LLM-driven UI automation via Android's AccessibilityService.
 * The service must be enabled by the user in Android Settings → Accessibility.
 */
import { NativeModules } from 'react-native';

const { AccessibilityModule } = NativeModules;

export interface AccessibilityModuleType {
  /** Returns true if the SannaAccessibilityService is currently connected. */
  isAccessibilityServiceEnabled(): Promise<boolean>;

  /** Opens Android's Accessibility Settings screen. */
  openAccessibilitySettings(): Promise<string>;

  /**
   * Captures the accessibility tree of the current foreground window.
   * Returns a human-readable text representation with node IDs.
   */
  getAccessibilityTree(): Promise<string>;

  /**
   * Perform an action on a UI node identified by nodeId.
   *
   * @param action  One of: click, long_click, type, clear, focus,
   *                scroll_forward, scroll_backward, back, home, recents
   * @param nodeId  Node ID from the tree (e.g. "node_5"). Pass null for global actions.
   * @param text    Text to set for the "type" action; null otherwise.
   */
  performAction(
    action: string,
    nodeId: string | null,
    text: string | null,
  ): Promise<string>;

  /**
   * Wait until the given package is in the foreground or the timeout elapses.
   * @param packageName  Android package name (e.g. "com.whatsapp")
   * @param timeoutMs    Max wait time in milliseconds
   * @returns true if the app became active within the timeout
   */
  waitForApp(packageName: string, timeoutMs: number): Promise<boolean>;
}

export default AccessibilityModule as AccessibilityModuleType;

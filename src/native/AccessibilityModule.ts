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
   * Automatically retries with increasing delays for apps that are slow to render.
   */
  getAccessibilityTree(): Promise<string>;

  /**
   * Perform an action on a UI node or a global/context action.
   *
   * Node actions (require nodeId):
   *   click, long_click, type, clear, focus, scroll_forward, scroll_backward
   *
   * Global actions (pass null for nodeId):
   *   back, home, recents, screenshot, clipboard_set, clipboard_get, paste
   *
   * @param action  Action name (see above).
   * @param nodeId  Node ID from the tree (e.g. "node_5"). Pass null for global actions.
   * @param text    Text to set for the "type" or "clipboard_set" action; null otherwise.
   */
  performAction(
    action: string,
    nodeId: string | null,
    text: string | null,
  ): Promise<string>;

  /**
   * Dispatch a swipe gesture from (x1, y1) to (x2, y2) over the given duration.
   * Useful for scrolling, dismissing notifications, or interacting with drag targets.
   *
   * @param x1        Start X in screen pixels
   * @param y1        Start Y in screen pixels
   * @param x2        End X in screen pixels
   * @param y2        End Y in screen pixels
   * @param durationMs  Gesture duration in milliseconds (e.g. 300)
   */
  performSwipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs: number,
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

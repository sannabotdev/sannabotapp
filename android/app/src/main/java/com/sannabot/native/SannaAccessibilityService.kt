package com.sannabot.native

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.accessibilityservice.GestureDescription
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * SannaAccessibilityService – Provides UI automation capabilities
 *
 * Allows the LLM agent to:
 * - Read the UI tree of any foreground app (as text)
 * - Perform actions: click, type, scroll, swipe, clipboard, screenshot, etc.
 *
 * Requires the user to enable "Sanna" in Android Settings → Accessibility.
 *
 * Stability improvements:
 * - buildAccessibilityTree() retries with increasing delays for slow-rendering apps
 * - click/long_click fall back to GestureDescription when performAction() fails
 * - Sanna's own overlay nodes are filtered out so the agent never sees them
 */
class SannaAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "SannaAccessibility"

        /** Singleton instance – set on connect, cleared on destroy */
        @Volatile
        var instance: SannaAccessibilityService? = null

        fun isRunning(): Boolean = instance != null
    }

    /** Node map: generated ID → AccessibilityNodeInfo copy (valid until next tree capture) */
    private val nodeMap = ConcurrentHashMap<String, AccessibilityNodeInfo>()
    private val nodeCounter = AtomicInteger(0)

    /** Track the currently focused package so waitForPackage() works */
    @Volatile
    private var currentPackageName: String = ""

    // ── Lifecycle ────────────────────────────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "Accessibility service connected")

        val info = serviceInfo ?: AccessibilityServiceInfo()
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
        info.flags = (AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS)
        serviceInfo = info
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        clearNodeMap()
        instance = null
        Log.i(TAG, "Accessibility service destroyed")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val pkg = event.packageName
        if (pkg != null && pkg.isNotBlank()) {
            currentPackageName = pkg.toString()
        }
    }

    // ── Public API (called from AccessibilityModule) ──────────────────────

    /**
     * Build a human-readable text representation of the current UI tree.
     * Populates nodeMap with copies of all nodes so performNodeAction() can find them.
     *
     * Retries up to 5 times with increasing delays (50–500ms) to handle apps that
     * are slow to render their UI after a cold launch.
     */
    fun buildAccessibilityTree(): String {
        // Retry with increasing delays — some apps take 500ms+ to render after launch
        val retryDelays = longArrayOf(50, 100, 200, 300, 500)

        for ((attempt, delayMs) in retryDelays.withIndex()) {
            clearNodeMap()

            val root = rootInActiveWindow
            if (root != null) {
                val sb = StringBuilder()
                // Prefer the package from the root node itself – it reflects the actual active window,
                // whereas currentPackageName is event-based and may still point to the previous app.
                val packageName = root.packageName?.toString()
                    ?.takeIf { it.isNotBlank() }
                    ?: currentPackageName
                sb.appendLine("Package: $packageName")
                sb.appendLine()

                try {
                    traverseNode(root, sb, 0)
                } finally {
                    root.recycle()
                }

                // Return immediately if we got a non-trivial tree.
                // On the last attempt, return whatever we have (even if empty).
                if (nodeMap.isNotEmpty() || attempt == retryDelays.size - 1) {
                    return sb.toString()
                }
            } else if (attempt == retryDelays.size - 1) {
                return "No active window found. Make sure the target app is open and in the foreground."
            }

            Thread.sleep(delayMs)
        }

        return "No active window found. Make sure the target app is open and in the foreground."
    }

    private fun traverseNode(node: AccessibilityNodeInfo, sb: StringBuilder, depth: Int) {
        // Skip Sanna's own overlay nodes so the agent never sees them
        if (node.packageName?.toString() == "com.sannabot") return

        val nodeId = "node_${nodeCounter.getAndIncrement()}"
        val indent = "  ".repeat(depth)

        // Store a copy so we can look it up for actions later
        try {
            nodeMap[nodeId] = AccessibilityNodeInfo.obtain(node)
        } catch (e: Exception) {
            Log.w(TAG, "Could not obtain node copy: ${e.message}")
        }

        // Derive a short class name for readability
        val className = node.className?.toString()?.substringAfterLast('.') ?: "View"
        val text = node.text?.toString()?.take(120) ?: ""
        val contentDesc = node.contentDescription?.toString()?.take(120) ?: ""
        val viewId = node.viewIdResourceName?.substringAfterLast('/') ?: ""

        val attrs = mutableListOf<String>()
        if (text.isNotBlank()) attrs.add("text=\"$text\"")
        if (contentDesc.isNotBlank() && contentDesc != text) attrs.add("desc=\"$contentDesc\"")
        if (viewId.isNotBlank()) attrs.add("res-id=\"$viewId\"")
        if (node.isClickable) attrs.add("clickable")
        if (node.isLongClickable) attrs.add("long-clickable")
        if (node.isFocusable) attrs.add("focusable")
        if (node.isEditable) attrs.add("editable")
        if (node.isScrollable) attrs.add("scrollable")
        if (node.isChecked) attrs.add("checked")
        if (node.isSelected) attrs.add("selected")
        if (!node.isEnabled) attrs.add("disabled")

        val attrStr = if (attrs.isNotEmpty()) " [${attrs.joinToString(", ")}]" else ""
        sb.appendLine("$indent[$nodeId] $className$attrStr")

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            traverseNode(child, sb, depth + 1)
            child.recycle()
        }
    }

    /**
     * Perform an action on a node, or a global/context action that needs no node.
     *
     * @param action  Node actions: click, long_click, type, clear, focus,
     *                scroll_forward, scroll_backward.
     *                Global actions (nodeId not required): back, home, recents,
     *                screenshot, clipboard_set, clipboard_get, paste.
     * @param nodeId  ID from the tree (e.g. "node_5"). Not needed for global actions.
     * @param text    Text to set for "type" or "clipboard_set".
     */
    fun performNodeAction(action: String, nodeId: String?, text: String?): String {
        // ── Global / no-node actions ──────────────────────────────────────────
        when (action) {
            "back" -> {
                performGlobalAction(GLOBAL_ACTION_BACK)
                return "Performed global back"
            }
            "home" -> {
                performGlobalAction(GLOBAL_ACTION_HOME)
                return "Performed global home"
            }
            "recents" -> {
                performGlobalAction(GLOBAL_ACTION_RECENTS)
                return "Performed global recents"
            }
            "screenshot" -> {
                return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val ok = performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
                    if (ok) "Screenshot taken" else "Screenshot global action failed"
                } else {
                    "Screenshot requires Android 9+"
                }
            }
            "clipboard_set" -> {
                if (text == null) return "'text' parameter is required for 'clipboard_set'"
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("sanna", text))
                return "Clipboard set to: \"$text\""
            }
            "clipboard_get" -> {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val content = clipboard.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
                return "Clipboard content: \"$content\""
            }
            "paste" -> {
                // Paste into the currently focused input node
                val focused = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
                if (focused != null) {
                    try {
                        val ok = focused.performAction(AccessibilityNodeInfo.ACTION_PASTE)
                        return if (ok) "Pasted into focused field" else "Paste failed on focused field"
                    } finally {
                        focused.recycle()
                    }
                }
                return "No focused field found to paste into"
            }
        }

        // All remaining actions require a nodeId
        if (nodeId == null) {
            return "No nodeId provided and action '$action' is not a global action. " +
                    "Global actions: back, home, recents, screenshot, clipboard_set, clipboard_get, paste."
        }

        // ── Node actions ────────────────────────────────────────────────────
        val node = nodeMap[nodeId]
            ?: return "Node '$nodeId' not found. The tree may be stale – call 'get_accessibility_tree' again."

        return when (action) {
            "click" -> {
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                if (ok) {
                    "Clicked [$nodeId]"
                } else {
                    // Fallback: dispatch a tap gesture at the node's center coordinates
                    val rect = Rect()
                    node.getBoundsInScreen(rect)
                    val cx = (rect.left + rect.right) / 2
                    val cy = (rect.top + rect.bottom) / 2
                    if (rect.width() > 0 && rect.height() > 0) {
                        dispatchTapGestureSync(cx, cy)
                    } else {
                        "Failed to click [$nodeId] (node may not be clickable or has no valid bounds)"
                    }
                }
            }
            "long_click" -> {
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)
                if (ok) {
                    "Long-clicked [$nodeId]"
                } else {
                    // Fallback: dispatch a long-press gesture at the node's center
                    val rect = Rect()
                    node.getBoundsInScreen(rect)
                    val cx = (rect.left + rect.right) / 2
                    val cy = (rect.top + rect.bottom) / 2
                    if (rect.width() > 0 && rect.height() > 0) {
                        dispatchLongPressGestureSync(cx, cy)
                    } else {
                        "Failed to long-click [$nodeId] (no valid bounds)"
                    }
                }
            }
            "focus" -> {
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS)
                if (ok) "Focused [$nodeId]" else "Failed to focus [$nodeId]"
            }
            "type" -> {
                if (text == null) return "'text' parameter is required for the 'type' action"
                // Click first to ensure focus, then set text
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                val args = Bundle().apply {
                    putCharSequence(
                        AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        text
                    )
                }
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
                if (ok) "Typed \"$text\" into [$nodeId]"
                else "Failed to type into [$nodeId] (node may not be editable)"
            }
            "clear" -> {
                val args = Bundle().apply {
                    putCharSequence(
                        AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        ""
                    )
                }
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
                if (ok) "Cleared [$nodeId]" else "Failed to clear [$nodeId]"
            }
            "scroll_forward" -> {
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                if (ok) "Scrolled forward on [$nodeId]" else "Failed to scroll forward on [$nodeId]"
            }
            "scroll_backward" -> {
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
                if (ok) "Scrolled backward on [$nodeId]" else "Failed to scroll backward on [$nodeId]"
            }
            else -> "Unknown action: '$action'. Available node actions: click, long_click, type, clear, " +
                    "focus, scroll_forward, scroll_backward. " +
                    "Global actions: back, home, recents, screenshot, clipboard_set, clipboard_get, paste."
        }
    }

    /**
     * Dispatch a swipe gesture across the screen.
     * This always blocks until the gesture completes or is cancelled (max 3 seconds).
     *
     * @param x1        Start X coordinate
     * @param y1        Start Y coordinate
     * @param x2        End X coordinate
     * @param y2        End Y coordinate
     * @param durationMs  Gesture duration in milliseconds (min 1)
     */
    fun performSwipe(x1: Int, y1: Int, x2: Int, y2: Int, durationMs: Int): String {
        return dispatchSwipeGestureSync(x1, y1, x2, y2, durationMs.toLong().coerceAtLeast(1))
    }

    /**
     * Find the interactive node at screen coordinates (x, y).
     * Useful when node IDs are unavailable or stale.
     */
    fun findNodeAt(x: Int, y: Int): AccessibilityNodeInfo? {
        val root = rootInActiveWindow ?: return null
        return findNodeAtRecursive(root, x, y)
    }

    private fun findNodeAtRecursive(
        node: AccessibilityNodeInfo,
        x: Int,
        y: Int
    ): AccessibilityNodeInfo? {
        val rect = Rect()
        node.getBoundsInScreen(rect)

        if (!rect.contains(x, y)) {
            node.recycle()
            return null
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findNodeAtRecursive(child, x, y)
            if (found != null) {
                node.recycle()
                return found
            }
        }

        return if (node.isClickable || node.isLongClickable || node.isEditable) {
            node
        } else {
            node.recycle()
            null
        }
    }

    /**
     * Block until the given package is in the foreground, or timeout elapses.
     * @return true if the app became active within the timeout.
     */
    fun waitForPackage(packageName: String, timeoutMs: Long): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            // Check both the event-based cache and the actual active window root.
            // The root-based check is more reliable after an Intent launches the target app.
            if (currentPackageName == packageName) return true
            try {
                val root = rootInActiveWindow
                if (root != null) {
                    val rootPkg = root.packageName?.toString()
                    root.recycle()
                    if (rootPkg == packageName) {
                        currentPackageName = packageName // sync the cache
                        return true
                    }
                }
            } catch (_: Exception) {}
            Thread.sleep(100)
        }
        return currentPackageName == packageName
    }

    // ── Gesture Helpers ──────────────────────────────────────────────────────

    /**
     * Dispatch a short tap gesture at the given screen coordinates.
     * Blocks (via CountDownLatch) until the gesture completes or times out.
     */
    private fun dispatchTapGestureSync(x: Int, y: Int): String {
        val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGestureSync(gesture, "Tap gesture at ($x, $y)")
    }

    /**
     * Dispatch a long-press gesture (1000ms) at the given screen coordinates.
     * Blocks until the gesture completes or times out.
     */
    private fun dispatchLongPressGestureSync(x: Int, y: Int): String {
        val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 1000)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGestureSync(gesture, "Long-press gesture at ($x, $y)")
    }

    /**
     * Dispatch a swipe gesture from (x1,y1) to (x2,y2) over the given duration.
     * Blocks until the gesture completes or times out.
     */
    private fun dispatchSwipeGestureSync(
        x1: Int, y1: Int,
        x2: Int, y2: Int,
        durationMs: Long
    ): String {
        val path = Path().apply {
            moveTo(x1.toFloat(), y1.toFloat())
            lineTo(x2.toFloat(), y2.toFloat())
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGestureSync(gesture, "Swipe from ($x1,$y1) to ($x2,$y2)")
    }

    /**
     * Synchronously dispatch a GestureDescription and wait up to 3 seconds for the result.
     * The GestureResultCallback fires on the main thread; CountDownLatch safely bridges to the caller.
     */
    private fun dispatchGestureSync(gesture: GestureDescription, description: String): String {
        val latch = CountDownLatch(1)
        var succeeded = false

        val dispatched = dispatchGesture(
            gesture,
            object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    succeeded = true
                    latch.countDown()
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    latch.countDown()
                }
            },
            null
        )

        if (!dispatched) return "$description: rejected (service may not support gestures)"
        latch.await(3, TimeUnit.SECONDS)
        return if (succeeded) "$description: completed" else "$description: cancelled or timed out"
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun clearNodeMap() {
        nodeMap.values.forEach {
            try { it.recycle() } catch (_: Exception) {}
        }
        nodeMap.clear()
        nodeCounter.set(0)
    }
}

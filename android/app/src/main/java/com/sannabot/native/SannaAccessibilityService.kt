package com.sannabot.native

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * SannaAccessibilityService – Provides UI automation capabilities
 *
 * Allows the LLM agent to:
 * - Read the UI tree of any foreground app (as text)
 * - Perform actions: click, type, scroll, etc.
 *
 * Requires the user to enable "Sanna" in Android Settings → Accessibility.
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
     */
    fun buildAccessibilityTree(): String {
        clearNodeMap()

        val root = rootInActiveWindow
            ?: return "No active window found. Make sure the target app is open and in the foreground."

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

        return sb.toString()
    }

    private fun traverseNode(node: AccessibilityNodeInfo, sb: StringBuilder, depth: Int) {
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
     * Perform an action on a node.
     * @param action  One of: click, long_click, type, clear, focus,
     *                scroll_forward, scroll_backward, back, home, recents
     * @param nodeId  ID from the tree (e.g. "node_5"). Not needed for back/home/recents.
     * @param text    Text to set for the "type" action.
     */
    fun performNodeAction(action: String, nodeId: String?, text: String?): String {
        // ── Global actions (no node needed) ────────────────────────────────
        if (nodeId == null || action == "back" || action == "home" || action == "recents") {
            return when (action) {
                "back" -> {
                    performGlobalAction(GLOBAL_ACTION_BACK)
                    "Performed global back"
                }
                "home" -> {
                    performGlobalAction(GLOBAL_ACTION_HOME)
                    "Performed global home"
                }
                "recents" -> {
                    performGlobalAction(GLOBAL_ACTION_RECENTS)
                    "Performed global recents"
                }
                else -> "No nodeId provided and action '$action' is not a global action. " +
                        "Global actions: back, home, recents."
            }
        }

        // ── Node actions ────────────────────────────────────────────────────
        val node = nodeMap[nodeId]
            ?: return "Node '$nodeId' not found. The tree may be stale – call 'get_accessibility_tree' again."

        return when (action) {
            "click" -> {
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                if (ok) "Clicked [$nodeId]" else "Failed to click [$nodeId] (node may not be clickable)"
            }
            "long_click" -> {
                val ok = node.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)
                if (ok) "Long-clicked [$nodeId]" else "Failed to long-click [$nodeId]"
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
                    "focus, scroll_forward, scroll_backward. Global actions: back, home, recents."
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun clearNodeMap() {
        nodeMap.values.forEach {
            try { it.recycle() } catch (_: Exception) {}
        }
        nodeMap.clear()
        nodeCounter.set(0)
    }
}

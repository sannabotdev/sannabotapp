/**
 * Accessibility Sub-Agent
 *
 * Runs an LLM loop that:
 * 1. Receives an accessibility tree as the FIRST USER MESSAGE (never in the system prompt)
 * 2. Plans which UI actions are needed
 * 3. Executes them via accessibility_action
 * 4. Refreshes the tree via get_accessibility_tree (returns updated tree to current loop)
 * 5. Terminates cleanly via finish_task (hard-stops the loop on success OR failure)
 *
 * Architectural principles:
 * – System prompt contains ONLY instructions, never state (= the UI tree).
 *   If the tree were in the system prompt it would become stale the moment
 *   the agent calls get_accessibility_tree, leaving two conflicting trees in
 *   context and causing the LLM to reference old node IDs.
 * – finish_task is the ONLY exit mechanism. Saying "STOP" in text is unreliable.
 *   When finish_task is called, the loop is hard-stopped via shouldExit callback.
 * – Error handling: finish_task(status:"failed") gives the agent a safe exit when
 *   it is stuck, preventing blind continuation past maxIterations.
 * – Learned hints: after each run, the headless task condenses the interaction into
 *   human-readable hints (no node IDs) and persists them. On the next run those
 *   hints are loaded here and injected into the system prompt before "Your Goal".
 */
import { ToolRegistry } from './tool-registry';
import { runToolLoop } from './tool-loop';
import type { LLMProvider, Message } from '../llm/types';
import AccessibilityModule from '../native/AccessibilityModule';
import type { Tool, ToolResult } from '../tools/types';
import { errorResult, successResult } from '../tools/types';
import { DebugLogger } from './debug-logger';
import { AccessibilityHintStore } from './accessibility-hint-store';
import { AccessibilityTaskMemory } from './accessibility-task-memory';
import { ActionHistoryTracker } from './accessibility-action-history';

export interface AccessibilitySubAgentConfig {
  provider: LLMProvider;
  /** Android package of the target app (e.g. "com.whatsapp") */
  packageName: string;
  /** Natural-language description of what to do */
  goal: string;
  /** Pre-captured accessibility tree text (passed as first user message, NOT system prompt) */
  accessibilityTree: string;
  /** Maximum number of tool loop iterations (default: 12) */
  maxIterations?: number;
  /** Optional personal memory context (read-only in this sub-agent). */
  personalMemory?: string;
}

export interface AccessibilitySubAgentResult {
  /** The human-readable summary returned by finish_task */
  message: string;
  /** 'success' | 'failed' from finish_task, or 'timeout' if max iterations hit */
  status: 'success' | 'failed' | 'timeout';
  /**
   * Full interaction history (initial tree message + all loop messages).
   * Used by the headless task to condense hints after each run.
   * Excludes the system prompt (which is instructions, not state).
   */
  messages: Message[];
}

/**
 * Run the accessibility sub-agent.
 * Returns the finish_task message + status (or a 'timeout' result if max iterations hit),
 * plus the full message history for hint condensing.
 */
export async function runAccessibilitySubAgent(
  config: AccessibilitySubAgentConfig,
): Promise<AccessibilitySubAgentResult> {
  const { provider, packageName, goal, accessibilityTree, maxIterations, personalMemory } = config;

  // ── Load learned hints for this app ─────────────────────────────────────
  const existingHints = await AccessibilityHintStore.getHints(packageName);

  // ── Initialize Task Memory and Action History ─────────────────────────
  const taskMemory = new AccessibilityTaskMemory();
  const actionHistory = new ActionHistoryTracker();

  // ── Termination state ────────────────────────────────────────────────────
  // Shared mutable ref used by FinishTaskTool to signal early loop exit.
  const termination: Termination = { done: false, message: '', status: 'success' };

  // ── Build tool registry ──────────────────────────────────────────────────
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new AccessibilityActionTool(actionHistory));
  toolRegistry.register(new GetAccessibilityTreeTool());
  toolRegistry.register(new RememberTaskInfoTool(taskMemory));
  toolRegistry.register(new FinishTaskTool(termination));

  // ── Learned hints section (only included if hints exist) ─────────────────
  const hintsSection = existingHints
    ? `## Learned Hints (from previous tasks)\n${existingHints}\n\n`
    : '';
  const memorySection = personalMemory?.trim()
    ? `## Personal Memory (Read-only)\n${personalMemory.trim()}\n\n`
    : '';

  // ── Format Memory Sections (dynamically updated) ────────────────────────
  const taskMemorySection = taskMemory.getFormattedMemory();
  const actionHistorySection = actionHistory.getFormattedHistory();

  // ── System prompt (instructions ONLY – no UI state) ───────────────────────
  const systemPrompt = `You are an Accessibility Sub-Agent for the Sanna AI assistant.
Your job is to control the Android UI of the app "${packageName}" to achieve a specific goal.

${hintsSection}${memorySection}${taskMemorySection ? taskMemorySection + '\n\n' : ''}${actionHistorySection ? actionHistorySection + '\n\n' : ''}## Your Goal
${goal}

## Initial Navigation
- After the app opens, check if you are on the app's main/home screen.
- If you are not on the home screen, use the \`home\` action (no node_id needed) to navigate back to the home screen of the app, then call \`get_accessibility_tree\` to see the updated state.
- Start your task from the app's home screen for consistency.

## Rules of Engagement (CRITICAL)
1. **Understand State:** Analyze the Accessibility Tree provided in the user messages. Identify clickable, editable, or scrollable nodes necessary for your goal.
2. **Take Action:** Use the \`accessibility_action\` tool to interact with the UI.
3. **Remember Important Info:** Use \`remember_task_info\` to store UI element locations, successful patterns, or errors to avoid. This helps in future steps.
4. **Refresh State:** After any action that changes the screen (typing, clicking a link, submitting), you MUST use \`get_accessibility_tree\` to see the new UI state.
5. **Node ID Volatility:** Node IDs (e.g. "node_5") are EPHEMERAL. NEVER reuse a node ID from an older tree. Always use the IDs from the most recently fetched Accessibility Tree.
6. **App Boundary:** Stay within "${packageName}". Only use the \`home\` action to navigate to the app's home screen when stuck or to reset state – do not use it for any other purpose.
7. **Confirmation:** Buttons containing "Send", "Senden", "OK", or "Submit" are typically your final action triggers.
8. **Error Recovery:** If you see recent action failures in the Action History, try a different approach. Don't repeat the same failed action.

## Termination & Failure (YOU MUST FOLLOW THIS)
- **Success:** ONLY call \`finish_task\` AFTER you have:
  1. Executed all necessary actions via \`accessibility_action\`
  2. Refreshed the tree with \`get_accessibility_tree\` to verify the final state
  3. Confirmed that the goal is actually achieved based on the current UI state
  Then call \`finish_task\` with \`status: "success"\` and describe what was ACTUALLY completed (not what you plan to do). Do NOT take any further actions after that.
- **Loading/Delay:** If the screen appears to be loading, use \`wait\` action to pause, then use \`get_accessibility_tree\` to poll the state again.
- **Dead End Recovery:** If you are stuck after 2 state refreshes without meaningful progress, use the \`home\` action to navigate back to the app's home screen, refresh the tree with \`get_accessibility_tree\`, and try a different approach from there.
- **Failure/Stuck:** If after Dead End Recovery you still cannot make progress, you MUST call \`finish_task\` with \`status: "failed"\` and explain why. This is the correct way to give up – do NOT keep retrying blindly.`;

  // ── First user message carries the initial UI tree ────────────────────────
  // The tree is state, not instruction → it belongs in the conversation, not
  // the system prompt.  When the agent calls get_accessibility_tree, a fresh
  // tree is appended as a new tool-result message, keeping the full history
  // coherent without a stale copy sitting in the system prompt.
  const firstUserMessage = `Here is the current Accessibility Tree for "${packageName}":

\`\`\`
${accessibilityTree}
\`\`\`

Please achieve the goal: ${goal}`;


  const initialUserMsg: Message = { role: 'user', content: firstUserMessage };

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    initialUserMsg,
  ];

  // ── Run the tool loop ────────────────────────────────────────────────────
  // Note: We need to update the system prompt dynamically, but the tool loop
  // doesn't support that. Instead, we'll update memory/history after each iteration
  // and rebuild the prompt. For now, we'll use a simpler approach: update the
  // system prompt once before the loop, and memory/history will be available
  // in the conversation context via tool results.
  
  // Update system prompt with current memory/history state before starting
  const updatedSystemPrompt = `You are an Accessibility Sub-Agent for the Sanna AI assistant.
Your job is to control the Android UI of the app "${packageName}" to achieve a specific goal.

${hintsSection}${memorySection}${taskMemorySection ? taskMemorySection + '\n\n' : ''}${actionHistorySection ? actionHistorySection + '\n\n' : ''}## Your Goal
${goal}

## Initial Navigation
- After the app opens, check if you are on the app's main/home screen.
- If you are not on the home screen, use the \`home\` action (no node_id needed) to navigate back to the home screen of the app, then call \`get_accessibility_tree\` to see the updated state.
- Start your task from the app's home screen for consistency.

## Rules of Engagement (CRITICAL)
1. **Understand State:** Analyze the Accessibility Tree provided in the user messages. Identify clickable, editable, or scrollable nodes necessary for your goal.
2. **Take Action:** Use the \`accessibility_action\` tool to interact with the UI.
3. **Remember Important Info:** Use \`remember_task_info\` to store UI element locations, successful patterns, or errors to avoid. This helps in future steps.
4. **Refresh State:** After any action that changes the screen (typing, clicking a link, submitting), you MUST use \`get_accessibility_tree\` to see the new UI state.
5. **Node ID Volatility:** Node IDs (e.g. "node_5") are EPHEMERAL. NEVER reuse a node ID from an older tree. Always use the IDs from the most recently fetched Accessibility Tree.
6. **App Boundary:** Stay within "${packageName}". Only use the \`home\` action to navigate to the app's home screen when stuck or to reset state – do not use it for any other purpose.
7. **Confirmation:** Buttons containing "Send", "Senden", "OK", or "Submit" are typically your final action triggers.
8. **Error Recovery:** If you see recent action failures in the Action History, try a different approach. Don't repeat the same failed action.

## Termination & Failure (YOU MUST FOLLOW THIS)
- **Success:** ONLY call \`finish_task\` AFTER you have:
  1. Executed all necessary actions via \`accessibility_action\`
  2. Refreshed the tree with \`get_accessibility_tree\` to verify the final state
  3. Confirmed that the goal is actually achieved based on the current UI state
  Then call \`finish_task\` with \`status: "success"\` and describe what was ACTUALLY completed (not what you plan to do). Do NOT take any further actions after that.
- **Loading/Delay:** If the screen appears to be loading, use \`wait\` action to pause, then use \`get_accessibility_tree\` to poll the state again.
- **Dead End Recovery:** If you are stuck after 2 state refreshes without meaningful progress, use the \`home\` action to navigate back to the app's home screen, refresh the tree with \`get_accessibility_tree\`, and try a different approach from there.
- **Failure/Stuck:** If after Dead End Recovery you still cannot make progress, you MUST call \`finish_task\` with \`status: "failed"\` and explain why. This is the correct way to give up – do NOT keep retrying blindly.`;

  messages[0] = { role: 'system', content: updatedSystemPrompt };

  const result = await runToolLoop(
    {
      provider,
      tools: toolRegistry,
      maxIterations: maxIterations ?? 12,
      shouldExit: () => termination.done,
      earlyExitContent: () => termination.message,
      onIterationComplete: () => {
        taskMemory.incrementStep();
        actionHistory.incrementStep();
      },
    },
    messages,
  );

  // ── Collect full interaction history for hint condensing ─────────────────
  // Exclude system prompt (instructions only), include initial tree + all loop messages.
  const interactionMessages: Message[] = [initialUserMsg, ...result.newMessages];

  // If the LLM exhausted iterations without calling finish_task, surface that.
  if (!termination.done) {
    return {
      message: 'The automation reached the iteration limit without completing the task.',
      status: 'timeout',
      messages: interactionMessages,
    };
  }

  return {
    message: termination.message || 'Task completed (no message returned).',
    status: termination.status,
    messages: interactionMessages,
  };
}

// ── AccessibilityActionTool ───────────────────────────────────────────────────

/**
 * Actions that operate on a specific node from the accessibility tree.
 * All of these require node_id.
 */
const NODE_REQUIRED_ACTIONS = [
  'click',
  'long_click',
  'type',
  'clear',
  'focus',
  'scroll_forward',
  'scroll_backward',
] as const;

/**
 * Executes a single UI action in the currently open app.
 *
 * Node actions (require node_id): click, long_click, type, clear, focus,
 *   scroll_forward, scroll_backward.
 * Global actions (no node_id): home, back, recents, screenshot,
 *   clipboard_set, clipboard_get, paste.
 * Gesture actions (require coordinates): swipe.
 * Timing action: wait (requires duration).
 */
class AccessibilityActionTool implements Tool {
  private actionHistory?: ActionHistoryTracker;

  constructor(actionHistory?: ActionHistoryTracker) {
    this.actionHistory = actionHistory;
  }

  name(): string {
    return 'accessibility_action';
  }

  description(): string {
    return (
      'Execute a UI action in the currently open app. ' +
      'Node actions (require node_id): click, long_click, type, clear, focus, scroll_forward, scroll_backward. ' +
      'Global actions (no node_id required): back, home, recents, screenshot, clipboard_set, clipboard_get, paste. ' +
      'For "type" action, provide the text in the "text" parameter. ' +
      'For "clipboard_set" action, provide the text to set in the "text" parameter. ' +
      'Use "swipe" with x1/y1/x2/y2 coordinates for swipe gestures. ' +
      'Use "wait" with duration parameter to pause execution (useful for loading screens). ' +
      'Use "home" (no node_id) to navigate to the app\'s home screen when stuck.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description:
            'Action to perform. ' +
            'Node actions (require node_id): ' +
            '"click" – tap a node; ' +
            '"long_click" – long-press a node; ' +
            '"type" – set text in an editable field (requires text param); ' +
            '"clear" – clear text in a field; ' +
            '"focus" – give accessibility focus to a node; ' +
            '"scroll_forward" – scroll forward/down on a scrollable node; ' +
            '"scroll_backward" – scroll backward/up on a scrollable node. ' +
            'Global actions (no node_id needed): ' +
            '"home" – navigate to the app\'s home/main screen (use when stuck); ' +
            '"back" – press the system back button; ' +
            '"screenshot" – take a screenshot (Android 9+); ' +
            '"clipboard_set" – copy text to clipboard (requires text param); ' +
            '"clipboard_get" – read current clipboard content; ' +
            '"paste" – paste clipboard into the currently focused field. ' +
            'Gesture action: ' +
            '"swipe" – swipe from (x1,y1) to (x2,y2), requires x1/y1/x2/y2 params. ' +
            'Timing action: ' +
            '"wait" – wait for a specified duration in milliseconds (requires duration param).',
          enum: [
            'click',
            'long_click',
            'type',
            'clear',
            'focus',
            'scroll_forward',
            'scroll_backward',
            'home',
            'back',
            'screenshot',
            'clipboard_set',
            'clipboard_get',
            'paste',
            'swipe',
            'wait',
          ],
        },
        node_id: {
          type: 'string',
          description:
            'Node ID from the accessibility tree (e.g. "node_5"). ' +
            'Required for: click, long_click, type, clear, focus, scroll_forward, scroll_backward. ' +
            'Not needed for global or gesture actions.',
        },
        text: {
          type: 'string',
          description:
            'Text to use. Required when action is "type" or "clipboard_set".',
        },
        x1: {
          type: 'number',
          description: 'Start X coordinate in screen pixels. Required for "swipe".',
        },
        y1: {
          type: 'number',
          description: 'Start Y coordinate in screen pixels. Required for "swipe".',
        },
        x2: {
          type: 'number',
          description: 'End X coordinate in screen pixels. Required for "swipe".',
        },
        y2: {
          type: 'number',
          description: 'End Y coordinate in screen pixels. Required for "swipe".',
        },
        duration: {
          type: 'number',
          description:
            'Swipe gesture duration in milliseconds. Optional for "swipe" (default: 300). ' +
            'Wait duration in milliseconds. Required for "wait" (0-10000ms, default: 1000).',
        },
      },
      required: ['action'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as string;
    const nodeId = (args.node_id as string | undefined) ?? null;
    const text = (args.text as string | undefined) ?? null;

    if (!action) {
      return errorResult('action parameter is required');
    }

    // ── Wait: timing action ─────────────────────────────────────────────────
    if (action === 'wait') {
      const duration = (args.duration as number | undefined) ?? 1000;

      if (duration < 0 || duration > 10000) {
        return errorResult('"duration" must be between 0 and 10000 milliseconds');
      }

      try {
        await new Promise<void>(resolve => setTimeout(() => resolve(), duration));
        return successResult(`Waited ${duration}ms`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return errorResult(`Wait failed: ${errMsg}`);
      }
    }

    // ── Swipe: coordinate-based gesture ──────────────────────────────────────
    if (action === 'swipe') {
      const x1 = args.x1 as number | undefined;
      const y1 = args.y1 as number | undefined;
      const x2 = args.x2 as number | undefined;
      const y2 = args.y2 as number | undefined;
      const duration = (args.duration as number | undefined) ?? 300;

      if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
        return errorResult('"x1", "y1", "x2", "y2" are required for the "swipe" action');
      }

      try {
        const result = await AccessibilityModule.performSwipe(x1, y1, x2, y2, duration);
        // Track successful swipe
        if (this.actionHistory) {
          this.actionHistory.record(action, null, true);
        }
        return successResult(result);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Track failed swipe
        if (this.actionHistory) {
          this.actionHistory.record(action, null, false, errMsg);
        }
        return errorResult(`Swipe gesture failed: ${errMsg}`);
      }
    }

    // ── Node actions: require node_id ─────────────────────────────────────────
    if ((NODE_REQUIRED_ACTIONS as readonly string[]).includes(action) && !nodeId) {
      return errorResult(
        `"node_id" parameter is required for action "${action}" – pick a node from the accessibility tree`,
      );
    }

    // ── Validation for text-requiring actions ─────────────────────────────────
    if (action === 'type' && !text) {
      return errorResult('"text" parameter is required when action is "type"');
    }
    if (action === 'clipboard_set' && !text) {
      return errorResult('"text" parameter is required when action is "clipboard_set"');
    }

    // ── Dispatch to native ────────────────────────────────────────────────────
    try {
      const result = await AccessibilityModule.performAction(action, nodeId, text);
      // Track successful action
      if (this.actionHistory) {
        this.actionHistory.record(action, nodeId, true);
      }
      return successResult(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Track failed action
      if (this.actionHistory) {
        this.actionHistory.record(action, nodeId, false, errMsg);
      }
      return errorResult(`Accessibility action failed: ${errMsg}`);
    }
  }
}

// ── FinishTaskTool ────────────────────────────────────────────────────────────

interface Termination {
  done: boolean;
  message: string;
  status: 'success' | 'failed';
}

/**
 * The ONLY correct way for the sub-agent to terminate.
 *
 * When this tool is called, the shared `termination` ref is updated and the
 * runToolLoop's `shouldExit` callback fires, hard-stopping the loop.
 * No further LLM calls are made after this point.
 */
class FinishTaskTool implements Tool {
  private termination: Termination;

  constructor(termination: Termination) {
    this.termination = termination;
  }

  name(): string {
    return 'finish_task';
  }

  description(): string {
    return (
      'Signal that the task is complete or that you are unable to complete it. ' +
      'Call this with status "success" ONLY AFTER you have verified that the goal has been achieved ' +
      '(by checking the accessibility tree and confirming the desired state is visible). ' +
      'Call with status "failed" if you are stuck and cannot make progress. ' +
      'THIS IS THE ONLY WAY TO END YOUR TASK. You MUST call this tool when done. ' +
      'IMPORTANT: Only call this AFTER all actions have been executed and verified. ' +
      'The message should describe what was ACTUALLY completed, not what you plan to do.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['success', 'failed'],
          description:
            '"success" – goal was achieved and verified. "failed" – could not complete the goal.',
        },
        message: {
          type: 'string',
          description:
            'A clear, concise summary describing what was ACTUALLY completed (for success) or what went wrong (for failed). ' +
            'Only describe actions that have been fully executed and verified. ' +
            'Use past tense to describe completed actions (e.g., "Opened Player FM and navigated to the podcast").',
        },
      },
      required: ['status', 'message'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const status = args.status as string;
    const message = (args.message as string) || '';

    this.termination.done = true;
    this.termination.message = message;
    this.termination.status = status as 'success' | 'failed';

    const prefix = status === 'success' ? '✅' : '❌';
    return successResult(`${prefix} finish_task called with status="${status}": ${message}`);
  }
}

// ── RememberTaskInfoTool ────────────────────────────────────────────────────

/**
 * Tool zum Speichern von Task-spezifischen Informationen während der Automation.
 *
 * Verwendet für:
 * - UI-Elemente die gefunden wurden (z.B. "Login button is typically at node_12 in home screen")
 * - Erfolgreiche Aktionen (z.B. "At step 3, successfully navigated to settings via menu button")
 * - Fehler die vermieden werden sollten (z.B. "At step 5, clicking node_8 did not work, use node_15 instead")
 * - Wichtige UI-States (z.B. "App requires 2-factor authentication, code is sent via SMS")
 */
class RememberTaskInfoTool implements Tool {
  private taskMemory: AccessibilityTaskMemory;

  constructor(taskMemory: AccessibilityTaskMemory) {
    this.taskMemory = taskMemory;
  }

  name(): string {
    return 'remember_task_info';
  }

  description(): string {
    return (
      'Remember important information discovered during this task. ' +
      'Use this to store UI element locations, successful action patterns, errors to avoid, ' +
      'or important app states. This information will be available in future steps of the same task. ' +
      'Examples: "Login button is at the top right", "Settings menu requires scrolling down first", ' +
      '"At step 3, found the search field at node_12". ' +
      'The step number is automatically added, so you can just describe what you learned.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        information: {
          type: 'string',
          description:
            'Information to remember. Should be concise and actionable. ' +
            'Examples: "Search button is in the top bar", "Settings requires scrolling to bottom", ' +
            '"Login form appears after clicking \'Sign In\' button".',
          minLength: 5,
          maxLength: 200,
        },
      },
      required: ['information'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const information = args.information as string | undefined;

    if (!information || !information.trim()) {
      return errorResult('"information" parameter is required and cannot be empty');
    }

    this.taskMemory.remember(information);

    return successResult(`Remembered: ${information}`);
  }
}

// ── GetAccessibilityTreeTool ──────────────────────────────────────────────────

/**
 * Refreshes the accessibility tree and returns it to the CURRENT loop context.
 *
 * IMPORTANT: Does NOT spawn a new sub-agent. The fresh tree is added as a
 * tool-result message so the LLM can see what changed without losing history
 * of actions already taken.
 */
class GetAccessibilityTreeTool implements Tool {
  name(): string {
    return 'get_accessibility_tree';
  }

  description(): string {
    return (
      'Re-capture the current UI tree of the open app. ' +
      'Returns the updated tree so you can see what changed after your last action. ' +
      'Use this after typing text, clicking a button, or when the screen changed. ' +
      'After receiving the new tree, ALWAYS use the new node IDs – old ones are invalid. ' +
      'Use this at most 3 times total. If still stuck after 3 refreshes, call finish_task with status "failed".'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Brief explanation of why you need to refresh the tree.',
        },
      },
      required: [],
    };
  }

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    try {
      // Small delay so the app UI can settle after previous actions
      await new Promise<void>(resolve => setTimeout(() => resolve(), 800));
      const freshTree = await AccessibilityModule.getAccessibilityTree();
      return successResult(freshTree);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to refresh accessibility tree: ${errMsg}`);
    }
  }
}

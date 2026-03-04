/**
 * AppSearchTool – Search installed Android apps by name
 *
 * Allows the LLM to resolve a natural-language app name (e.g. "parken app",
 * "maps") to an Android package name before calling the `accessibility` tool.
 *
 * Flow:
 *   1. User says "starte die [app name] app und [action]"
 *   2. LLM calls app_search with query="[app name]"
 *   3. Tool returns matching apps with package names
 *   4. LLM picks the correct one and calls `accessibility` with package_name
 *
 * If no exact match is found and LLM provider is available, uses LLM to find
 * the best matching app from all installed apps, or returns _NO_MATCH_ if none fits.
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import IntentModule from '../native/IntentModule';
import type { LLMProvider } from '../llm/types';
import { DebugLogger } from '../agent/debug-logger';

const FUZZY_MATCH_PROMPT = `You are an app search assistant. Your task is to find the best matching Android app from a list of installed apps based on a user's search query.

Given:
- A search query (e.g., "parken app", "maps", "banking")
- A list of all installed apps with their display names and package names

Your job:
1. Analyze the search query and understand what app the user is looking for
2. Find the app from the list that best matches the query
3. If no app reasonably matches the query, respond with exactly: _NO_MATCH_

Response format:
- If you find a matching app, respond with exactly: package: <package_name>
- If no app matches, respond with exactly: _NO_MATCH_

Do not include any explanation, commentary, or additional text. Only return the package name or _NO_MATCH_.`;

export class AppSearchTool implements Tool {
  private provider?: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider;
  }

  name(): string {
    return 'app_search';
  }

  description(): string {
    return (
      'Search for installed Android apps by name. ' +
      'Use this to find the package name of an app before using the `accessibility` tool. ' +
      'Example: query="parken" returns all parking-related installed apps with their package names.'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'App name or partial name to search for (case-insensitive). ' +
            'Example: "parken", "maps", "bank"',
        },
      },
      required: ['query'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;

    if (!query || query.trim().length === 0) {
      return errorResult('"query" parameter is required');
    }

    try {
      const apps = await IntentModule.searchInstalledApps(query.trim());

      // If exact matches found, return them as before
      if (apps && apps.length > 0) {
        const lines = apps.map((app, i) => `${i + 1}. ${app.name} (${app.package})`);
        const result =
          `Found ${apps.length} app${apps.length === 1 ? '' : 's'} matching "${query}":\n` +
          lines.join('\n');

        return successResult(result);
      }

      // No exact matches found - try LLM fuzzy matching if provider is available
      if (this.provider) {
        try {
          const allApps = await IntentModule.getAllInstalledApps();

          if (!allApps || allApps.length === 0) {
            return successResult(
              `No installed apps found matching "${query}". ` +
              'The app may not be installed on this device.',
            );
          }

          // Build app list for LLM
          const appList = allApps
            .map((app, i) => `${i + 1}. ${app.name} (${app.package})`)
            .join('\n');

          const userMessage = `Search query: "${query}"\n\nInstalled apps:\n${appList}`;

          const messages = [
            { role: 'system' as const, content: FUZZY_MATCH_PROMPT },
            { role: 'user' as const, content: userMessage },
          ];

          DebugLogger.logLLMRequest(
            this.provider.getCurrentModel(),
            messages.length,
            0,
            messages,
          );
          const response = await this.provider.chat(messages, []);
          DebugLogger.logLLMResponse(response.content, [], response.usage, response);

          const result = response.content?.trim() || '';

          // Check if LLM returned _NO_MATCH_
          if (result === '_NO_MATCH_') {
            return successResult(
              `No installed apps found matching "${query}". ` +
              'The app may not be installed on this device.',
            );
          }

          // Check if LLM returned a package name
          const packageMatch = result.match(/^package:\s*(.+)$/i);
          if (packageMatch) {
            const packageName = packageMatch[1].trim();
            // Find the app by package name
            const matchedApp = allApps.find(app => app.package === packageName);
            if (matchedApp) {
              return successResult(
                `Found 1 app matching "${query}":\n1. ${matchedApp.name} (${matchedApp.package})`,
              );
            }
          }

          // LLM response was unexpected format - fall through to default message
        } catch (llmErr) {
          // If LLM call fails, fall back to default message
          const message = llmErr instanceof Error ? llmErr.message : String(llmErr);
          DebugLogger.add('error', 'AppSearchTool', `LLM fuzzy match failed: ${message}`);
        }
      }

      // No LLM provider or LLM failed - return default message
      return successResult(
        `No installed apps found matching "${query}". ` +
        'The app may not be installed on this device.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`App search failed: ${message}`);
    }
  }
}

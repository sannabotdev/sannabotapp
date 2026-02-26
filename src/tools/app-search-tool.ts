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
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import IntentModule from '../native/IntentModule';

export class AppSearchTool implements Tool {
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

      if (!apps || apps.length === 0) {
        return successResult(
          `No installed apps found matching "${query}". ` +
          'The app may not be installed on this device.',
        );
      }

      const lines = apps.map((app, i) => `${i + 1}. ${app.name} (${app.package})`);
      const result =
        `Found ${apps.length} app${apps.length === 1 ? '' : 's'} matching "${query}":\n` +
        lines.join('\n');

      return successResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`App search failed: ${message}`);
    }
  }
}

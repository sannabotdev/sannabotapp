/**
 * HttpTool – REST API calls with automatic token management
 *
 * The LLM uses this tool for:
 *   - Gmail API
 *   - Spotify Web API
 *   - Google Calendar API
 *   - Weather APIs
 *   - Any REST endpoint
 */
import type { Tool, ToolResult } from './types';
import { errorResult, successResult } from './types';
import type { CredentialManager } from '../permissions/credential-manager';

export class HttpTool implements Tool {
  private credentialManager: CredentialManager;

  constructor(credentialManager: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  name(): string {
    return 'http';
  }

  description(): string {
    return 'Make REST API requests. Supports GET/POST/PUT/DELETE with automatic credential injection via auth_provider.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method',
        },
        url: {
          type: 'string',
          description: 'Full URL including query parameters',
        },
        auth_provider: {
          type: 'string',
          description:
            'Credential ID for automatic auth injection (e.g. "google", "spotify", "google_maps_api_key"). ' +
            'OAuth tokens are injected as Authorization: Bearer. ' +
            'API keys are injected into the header specified by auth_header.',
        },
        auth_header: {
          type: 'string',
          description:
            'Header name for API key injection (required when auth_provider is an API key credential).',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PUT/PATCH requests',
        },
        response_format: {
          type: 'string',
          enum: ['json', 'text'],
          description: 'Expected response format (default: json)',
        },
      },
      required: ['method', 'url'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const method = (args.method as string) ?? 'GET';
    const url = args.url as string;
    const authProvider = args.auth_provider as string | undefined;
    const authHeader = args.auth_header as string | undefined;
    const headers = (args.headers as Record<string, string>) ?? {};
    const body = args.body as Record<string, unknown> | undefined;
    const responseFormat = (args.response_format as string) ?? 'json';

    if (!url) {
      return errorResult('url parameter is required');
    }

    try {
      // Auto-inject auth token or API key if provider specified
      if (authProvider) {
        // Try OAuth token first
        const token = await this.credentialManager.getToken(authProvider);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          // Fallback to API key – inject into the caller-specified header
          const apiKey = await this.credentialManager.getApiKey(authProvider);
          if (apiKey) {
            if (!authHeader) {
              return errorResult(
                `auth_provider "${authProvider}" resolved to an API key but no auth_header was specified. ` +
                'Provide auth_header (e.g. "X-Goog-Api-Key") to indicate which header to use.',
              );
            }
            headers[authHeader] = apiKey;
          } else {
            return errorResult(
              `No valid token or API key for "${authProvider}". Please configure in settings.`,
            );
          }
        }
      }

      const requestInit: RequestInit = {
        method,
        headers: {
          'User-Agent': 'SannaBot/1.0',
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        requestInit.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestInit);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error message available');
        return errorResult(
          `HTTP ${response.status} ${response.statusText}: ${errorText.slice(0, 200)}`,
        );
      }

      // Read body as text first – some APIs (e.g. Spotify 204 No Content)
      // return an empty body even on success, which would crash response.json()
      const rawText = await response.text();

      let responseText: string;
      if (!rawText) {
        // Empty body – treat as success with no content (e.g. Spotify play/pause/skip)
        responseText = `HTTP ${response.status} (no body)`;
      } else if (responseFormat === 'json') {
        try {
          const json = JSON.parse(rawText);
          responseText = JSON.stringify(json, null, 2);
        } catch {
          // Not valid JSON – return raw text as-is
          responseText = rawText;
        }
      } else {
        responseText = rawText;
      }

      // Truncate very long responses
      const truncated = responseText.length > 5000
        ? responseText.slice(0, 5000) + '\n... (truncated, response too long)'
        : responseText;

      return successResult(truncated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`HTTP request failed: ${message}`);
    }
  }
}

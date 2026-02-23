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
    return 'REST API Anfragen stellen. Unterstützt GET/POST/PUT/DELETE mit automatischem OAuth Token-Management.';
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP Methode',
        },
        url: {
          type: 'string',
          description: 'Vollständige URL inkl. Query-Parameter',
        },
        auth_provider: {
          type: 'string',
          description:
            'Auth-Provider für automatisches Token-Management (z.B. "google", "spotify"). Leer lassen wenn kein Auth nötig.',
        },
        headers: {
          type: 'object',
          description: 'Optionale HTTP-Header',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'object',
          description: 'Request-Body für POST/PUT/PATCH Anfragen',
        },
        response_format: {
          type: 'string',
          enum: ['json', 'text'],
          description: 'Erwartetes Antwortformat (Standard: json)',
        },
      },
      required: ['method', 'url'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const method = (args.method as string) ?? 'GET';
    const url = args.url as string;
    const authProvider = args.auth_provider as string | undefined;
    const headers = (args.headers as Record<string, string>) ?? {};
    const body = args.body as Record<string, unknown> | undefined;
    const responseFormat = (args.response_format as string) ?? 'json';

    if (!url) {
      return errorResult('url parameter is required');
    }

    try {
      // Auto-inject auth token if provider specified
      if (authProvider) {
        const token = await this.credentialManager.getToken(authProvider);
        if (!token) {
          return errorResult(
            `Kein gültiger Token für "${authProvider}". Bitte in den Einstellungen anmelden.`,
          );
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const requestInit: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        requestInit.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestInit);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Keine Fehlermeldung verfügbar');
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
        responseText = `HTTP ${response.status} (kein Body)`;
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
        ? responseText.slice(0, 5000) + '\n... (abgeschnitten, Antwort zu lang)'
        : responseText;

      return successResult(truncated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`HTTP Anfrage fehlgeschlagen: ${message}`);
    }
  }
}

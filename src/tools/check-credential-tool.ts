/**
 * CheckCredentialTool – let the LLM verify whether a credential is configured
 *
 * The LLM uses this tool before attempting operations that require an OAuth
 * token or API key (e.g. Google Maps Routes API, Spotify, Slack).  If a
 * credential is missing the LLM can inform the user and ask them to configure
 * it in Settings instead of blindly failing mid-task.
 */
import type { Tool, ToolResult } from './types';
import { successResult, errorResult } from './types';
import type { CredentialManager } from '../permissions/credential-manager';

export class CheckCredentialTool implements Tool {
  private credentialManager: CredentialManager;

  constructor(credentialManager: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  name(): string {
    return 'check_credential';
  }

  description(): string {
    return (
      'Check whether a credential (OAuth token, API key, or password) is currently configured. ' +
      'Returns { "configured": true/false }. ' +
      'Use this before calling services that require authentication to avoid failing mid-task. ' +
      'Example credential IDs: "google" (Google OAuth), "spotify", "slack", "google_maps_api_key".'
    );
  }

  parameters(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        credential_id: {
          type: 'string',
          description:
            'The credential ID to check. ' +
            'OAuth providers: "google", "spotify", "slack". ' +
            'API keys: "google_maps_api_key".',
        },
      },
      required: ['credential_id'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const credId = args.credential_id as string;

    if (!credId || credId.trim().length === 0) {
      return errorResult('"credential_id" parameter is required');
    }

    try {
      const configured = await this.credentialManager.isConfigured(credId.trim());
      return successResult(JSON.stringify({ configured }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Failed to check credential status: ${message}`);
    }
  }
}

/**
 * SlackAuth – Slack PKCE OAuth 2.0 flow
 *
 * Uses react-native-app-auth for PKCE flow.
 * Stores tokens in CredentialManager under the provider key "slack".
 *
 * Setup:
 *   1. Create a Slack App at https://api.slack.com/apps
 *   2. Enable OAuth 2.0 + add your HTTPS redirect URL (see DEV_SETUP.md)
 *      Slack requires HTTPS – use a tiny GitHub Pages redirect page that
 *      forwards back to the app via the custom scheme sannabot://slack-callback
 *   3. Add the required User Token Scopes (see SCOPES below)
 *   4. Copy Client ID → local.config.ts → slackClientId
 *   5. Copy redirect URL → local.config.ts → slackRedirectUrl
 */
import { authorize, refresh } from 'react-native-app-auth';
import type { CredentialManager } from './credential-manager';
import type { CredentialRequirement } from '../agent/skill-loader';

/** User Token Scopes required by the Slack Skill */
const SCOPES = [
  'channels:history',    // Read messages in public channels
  'channels:read',       // List channels
  'chat:write',          // Send messages
  'im:history',          // Read direct messages
  'im:write',            // Open DMs
  'mpim:history',        // Read group DMs
  'users:read',          // List / resolve users
  'users:read.email',    // Look up users by e-mail
  'users.profile:write', // Set own status
];

// Fallback redirect URL – must match what's registered in the Slack App Dashboard.
// Slack requires HTTPS; use the GitHub Pages redirect page (see DEV_SETUP.md).
const DEFAULT_REDIRECT_URL = 'sannabot://slack-callback';

export class SlackAuth {
  private credentialManager: CredentialManager;
  private clientId = '';
  private redirectUrl = DEFAULT_REDIRECT_URL;

  constructor(credentialManager: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  configure(clientId: string, redirectUrl?: string): void {
    this.clientId = clientId;
    if (redirectUrl) {
      this.redirectUrl = redirectUrl;
    }
    this.credentialManager.setSlackClientId(clientId);
  }

  private get authConfig() {
    return {
      clientId: this.clientId,
      redirectUrl: this.redirectUrl,
      scopes: SCOPES,
      serviceConfiguration: {
        authorizationEndpoint: 'https://slack.com/oauth/v2/authorize',
        tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
      },
      usePKCE: true,
      additionalParameters: {
        // Request a user token (not just a bot token)
        user_scope: SCOPES.join(','),
      },
    };
  }

  /** Register setup handler so CredentialManager can trigger the OAuth flow */
  registerSetupHandler(): void {
    this.credentialManager.registerSetupHandler(
      'slack',
      async (_cred: CredentialRequirement) => {
        await this.signIn();
      },
    );
  }

  /** Start Slack PKCE OAuth flow and persist the token */
  async signIn(): Promise<string> {
    if (!this.clientId) {
      throw new Error('SlackAuth not configured. Call configure() first.');
    }

    const result = await authorize(this.authConfig);

    await this.credentialManager.saveOAuthToken('slack', {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.accessTokenExpirationDate
        ? new Date(result.accessTokenExpirationDate).getTime()
        : undefined,
      tokenType: result.tokenType ?? 'Bearer',
      scope: result.scopes?.join(' '),
    });

    return result.accessToken;
  }

  /** Refresh access token using stored refresh token */
  async refreshToken(): Promise<string | null> {
    const stored = await this.credentialManager.getFullOAuthToken('slack');
    if (!stored?.refreshToken) return null;

    try {
      const result = await refresh(this.authConfig, { refreshToken: stored.refreshToken });

      await this.credentialManager.saveOAuthToken('slack', {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? stored.refreshToken,
        expiresAt: result.accessTokenExpirationDate
          ? new Date(result.accessTokenExpirationDate).getTime()
          : undefined,
        tokenType: result.tokenType ?? 'Bearer',
      });

      return result.accessToken;
    } catch {
      return null;
    }
  }

  /** Sign out and remove stored credentials */
  async signOut(): Promise<void> {
    await this.credentialManager.revokeCredential('slack');
  }

  /** Check if a valid token is stored */
  async isAuthenticated(): Promise<boolean> {
    return this.credentialManager.isConfigured('slack');
  }
}

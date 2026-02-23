/**
 * CredentialManager – Manages OAuth tokens, API keys and passwords
 *
 * Three credential types:
 *   oauth    → OAuth 2.0 flow (Google, Spotify). TokenStore + auto-refresh.
 *   api_key  → Manual API key entry. Stored in TokenStore.
 *   password → Username + password pair. Stored in TokenStore.
 */
import { TokenStore, type OAuthToken } from './token-store';
import type { CredentialRequirement } from '../agent/skill-loader';

// Spotify PKCE OAuth config
const SPOTIFY_AUTH_CONFIG = {
  clientId: '', // Set via SettingsScreen
  redirectUrl: 'sannabot://spotify-callback',
  scopes: [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
  ],
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// Slack PKCE OAuth config
const SLACK_AUTH_CONFIG = {
  clientId: '', // Set via configure()
  tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
};

export type CredentialSetupHandler = (cred: CredentialRequirement) => Promise<void>;
export type TokenRefreshHandler = () => Promise<string | null>;

export class CredentialManager {
  private tokenStore: TokenStore;
  private setupHandlers: Map<string, CredentialSetupHandler> = new Map();
  private tokenRefreshHandlers: Map<string, TokenRefreshHandler> = new Map();

  constructor(tokenStore: TokenStore) {
    this.tokenStore = tokenStore;
  }

  /** Register a custom setup handler for a credential type/provider */
  registerSetupHandler(authProvider: string, handler: CredentialSetupHandler): void {
    this.setupHandlers.set(authProvider, handler);
  }

  /**
   * Register a custom token refresh handler for a provider.
   * Called when the stored token is expired and the generic refreshToken() flow
   * doesn't apply (e.g. Google uses the Sign-In SDK for refresh).
   */
  registerTokenRefreshHandler(provider: string, handler: TokenRefreshHandler): void {
    this.tokenRefreshHandlers.set(provider, handler);
  }

  // ─── Status Checks ────────────────────────────────────────────────────────

  async isConfigured(credId: string): Promise<boolean> {
    return this.tokenStore.hasCredential(credId);
  }

  async areAllConfigured(creds: CredentialRequirement[]): Promise<boolean> {
    if (creds.length === 0) return true;
    const results = await Promise.all(creds.map(c => {
      // OAuth tokens are stored under the auth_provider key (e.g. 'google', 'spotify')
      // not under the credential ID (e.g. 'google_credentials')
      const key = c.type === 'oauth' && c.auth_provider ? c.auth_provider : c.id;
      return this.isConfigured(key);
    }));
    return results.every(Boolean);
  }

  // ─── Token retrieval (for HttpTool) ───────────────────────────────────────

  /** Get a valid access token for the given auth provider. Refreshes if expired. */
  async getToken(authProvider: string): Promise<string | null> {
    const token = await this.tokenStore.getOAuthToken(authProvider);
    if (!token) return null;

    if (this.tokenStore.isTokenExpired(token)) {
      // 1. Try provider-specific refresh handler (e.g. Google Sign-In SDK)
      const customHandler = this.tokenRefreshHandlers.get(authProvider);
      if (customHandler) {
        const freshToken = await customHandler();
        if (freshToken) return freshToken;
      }

      // 2. Fall back to generic OAuth refresh_token grant
      const refreshed = await this.refreshToken(authProvider, token);
      if (refreshed) {
        return refreshed.accessToken;
      }
      return null;
    }

    return token.accessToken;
  }

  /** Get API key */
  async getApiKey(credId: string): Promise<string | null> {
    return this.tokenStore.getApiKey(credId);
  }

  /** Get username/password */
  async getPassword(credId: string): Promise<{ username: string; password: string } | null> {
    return this.tokenStore.getPassword(credId);
  }

  /** Get full OAuth token object (for refresh flows) */
  async getFullOAuthToken(provider: string): Promise<import('./token-store').OAuthToken | null> {
    return this.tokenStore.getOAuthToken(provider);
  }

  // ─── Save credentials ─────────────────────────────────────────────────────

  async saveOAuthToken(provider: string, token: OAuthToken): Promise<void> {
    await this.tokenStore.saveOAuthToken(provider, token);
  }

  async saveApiKey(credId: string, key: string): Promise<void> {
    await this.tokenStore.saveApiKey(credId, key);
  }

  async savePassword(credId: string, username: string, password: string): Promise<void> {
    await this.tokenStore.savePassword(credId, username, password);
  }

  // ─── Revoke ───────────────────────────────────────────────────────────────

  async revokeCredential(credId: string): Promise<void> {
    await this.tokenStore.deleteCredential(credId);
  }

  // ─── Setup Flow ───────────────────────────────────────────────────────────

  /**
   * Start credential setup for a requirement.
   * Delegates to registered setup handler (set in SettingsScreen / OAuth flows).
   */
  async startSetup(cred: CredentialRequirement): Promise<void> {
    const handler = cred.auth_provider
      ? this.setupHandlers.get(cred.auth_provider)
      : this.setupHandlers.get(cred.type);

    if (handler) {
      await handler(cred);
    } else {
      throw new Error(
        `No setup handler registered for credential type "${cred.type}" / provider "${cred.auth_provider ?? 'none'}"`,
      );
    }
  }

  // ─── OAuth Token Refresh ──────────────────────────────────────────────────

  private async refreshToken(
    provider: string,
    token: OAuthToken,
  ): Promise<OAuthToken | null> {
    if (!token.refreshToken) return null;

    try {
      let tokenEndpoint: string;
      let params: URLSearchParams;

      if (provider === 'spotify') {
        tokenEndpoint = SPOTIFY_AUTH_CONFIG.tokenEndpoint;
        params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          client_id: SPOTIFY_AUTH_CONFIG.clientId,
        });
      } else if (provider === 'slack') {
        tokenEndpoint = SLACK_AUTH_CONFIG.tokenEndpoint;
        params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          client_id: SLACK_AUTH_CONFIG.clientId,
        });
      } else if (provider === 'google') {
        // Google token refresh requires client_id + client_secret
        // On Android, use Google Sign-In SDK instead (handled in GoogleAuth)
        return null;
      } else {
        return null;
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) return null;

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      const newToken: OAuthToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? token.refreshToken,
        expiresAt: data.expires_in
          ? Date.now() + data.expires_in * 1000
          : undefined,
        tokenType: 'Bearer',
      };

      await this.tokenStore.saveOAuthToken(provider, newToken);
      return newToken;
    } catch {
      return null;
    }
  }

  /** Spotify PKCE config getter (for use in SettingsScreen auth flow) */
  getSpotifyAuthConfig(): typeof SPOTIFY_AUTH_CONFIG {
    return SPOTIFY_AUTH_CONFIG;
  }

  setSpotifyClientId(clientId: string): void {
    SPOTIFY_AUTH_CONFIG.clientId = clientId;
  }

  setSlackClientId(clientId: string): void {
    SLACK_AUTH_CONFIG.clientId = clientId;
  }
}

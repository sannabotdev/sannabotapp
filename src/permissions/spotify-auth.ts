/**
 * SpotifyAuth – Spotify PKCE OAuth flow
 *
 * Uses react-native-app-auth for PKCE flow.
 * Stores tokens in CredentialManager.
 */
import { authorize, refresh } from 'react-native-app-auth';
import type { CredentialManager } from './credential-manager';
import type { CredentialRequirement } from '../agent/skill-loader';

const BASE_AUTH_CONFIG = {
  redirectUrl: 'sannabot://spotify-callback',
  scopes: [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
    'user-library-read',
  ],
  serviceConfiguration: {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
  },
  usePKCE: true,
};

export class SpotifyAuth {
  private credentialManager: CredentialManager;
  private clientId = '';

  constructor(credentialManager: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  configure(clientId: string): void {
    this.clientId = clientId;
    this.credentialManager.setSpotifyClientId(clientId);
  }

  /** Register setup handler in CredentialManager */
  registerSetupHandler(): void {
    this.credentialManager.registerSetupHandler(
      'spotify',
      async (_cred: CredentialRequirement) => {
        await this.signIn();
      },
    );
  }

  /** Start Spotify PKCE OAuth flow */
  async signIn(): Promise<string> {
    if (!this.clientId) {
      throw new Error('SpotifyAuth not configured. Call configure() first.');
    }

    const config = { ...BASE_AUTH_CONFIG, clientId: this.clientId };
    const result = await authorize(config);

    await this.credentialManager.saveOAuthToken('spotify', {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: new Date(result.accessTokenExpirationDate).getTime(),
      tokenType: result.tokenType,
      scope: result.scopes.join(' '),
    });

    return result.accessToken;
  }

  /** Refresh access token using refresh token */
  async refreshToken(): Promise<string | null> {
    const stored = await this.credentialManager.getFullOAuthToken('spotify');
    if (!stored?.refreshToken) return null;

    const config = { ...BASE_AUTH_CONFIG, clientId: this.clientId };

    try {
      const result = await refresh(config, { refreshToken: stored.refreshToken });

      await this.credentialManager.saveOAuthToken('spotify', {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? stored.refreshToken,
        expiresAt: new Date(result.accessTokenExpirationDate).getTime(),
        tokenType: result.tokenType,
      });

      return result.accessToken;
    } catch {
      return null;
    }
  }

  /** Sign out and revoke credentials */
  async signOut(): Promise<void> {
    // Token is stored under provider key 'spotify', not credential ID 'spotify_credentials'
    await this.credentialManager.revokeCredential('spotify');
  }

  /** Check if user is authenticated */
  async isAuthenticated(): Promise<boolean> {
    // Token is stored under provider key 'spotify'
    return this.credentialManager.isConfigured('spotify');
  }
}

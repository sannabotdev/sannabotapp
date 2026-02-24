/**
 * GoogleAuth – Google Sign-In + OAuth 2.0
 *
 * Uses @react-native-google-signin/google-signin for OAuth flow.
 * Stores tokens in TokenStore via CredentialManager.
 */
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { CredentialManager } from './credential-manager';
import type { CredentialRequirement } from '../agent/skill-loader';

const GOOGLE_SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
];

export class GoogleAuth {
  private credentialManager: CredentialManager;
  private initialized = false;

  constructor(credentialManager: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  /** Initialize Google Sign-In. Call once at app startup. */
  configure(webClientId: string): void {
    GoogleSignin.configure({
      webClientId,
      scopes: GOOGLE_SCOPES,
      offlineAccess: true, // Get refresh token
    });
    this.initialized = true;
  }

  /** Register setup handler in CredentialManager */
  registerSetupHandler(): void {
    this.credentialManager.registerSetupHandler(
      'google',
      async (cred: CredentialRequirement) => {
        await this.signIn();
      },
    );

    // Register token refresh handler so CredentialManager can auto-refresh
    // expired Google tokens via the Google Sign-In SDK
    this.credentialManager.registerTokenRefreshHandler(
      'google',
      () => this.getAccessToken(),
    );
  }

  /** Start Google Sign-In flow and save tokens */
  async signIn(): Promise<string> {
    if (!this.initialized) {
      throw new Error('GoogleAuth not configured. Call configure() first.');
    }

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Fully revoke previous access so the next signIn() triggers a fresh
      // consent screen that includes ALL current scopes (e.g. newly added ones).
      // signOut() alone is not enough – Google remembers granted scopes at account level.
      try { await GoogleSignin.revokeAccess(); } catch { /* ignore */ }
      try { await GoogleSignin.signOut(); } catch { /* ignore */ }

      const userInfo = await GoogleSignin.signIn();

      // Request any scopes that weren't granted during signIn
      // (belt-and-suspenders: ensures all GOOGLE_SCOPES are present)
      try {
        await GoogleSignin.addScopes({ scopes: GOOGLE_SCOPES });
      } catch { /* ignore – scopes may already be granted */ }

      const tokens = await GoogleSignin.getTokens();

      await this.credentialManager.saveOAuthToken('google', {
        accessToken: tokens.accessToken,
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600 * 1000,
      });

      return tokens.accessToken;
    } catch (error) {
      if ((error as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Google Sign-In cancelled');
      } else if ((error as { code?: string }).code === statusCodes.IN_PROGRESS) {
        throw new Error('Google Sign-In already in progress');
      } else if ((error as { code?: string }).code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services not available');
      }
      throw error;
    }
  }

  /** Get current access token, refreshing if needed */
  async getAccessToken(): Promise<string | null> {
    try {
      // GoogleSignin handles token refresh internally
      const tokens = await GoogleSignin.getTokens();
      if (tokens.accessToken) {
        // Update stored token
        await this.credentialManager.saveOAuthToken('google', {
          accessToken: tokens.accessToken,
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600 * 1000,
        });
        return tokens.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Sign out and revoke credentials */
  async signOut(): Promise<void> {
    await GoogleSignin.signOut();
    // Token is stored under provider key 'google', not credential ID 'google_credentials'
    await this.credentialManager.revokeCredential('google');
  }

  /** Check if user is signed in */
  async isSignedIn(): Promise<boolean> {
    try {
      const currentUser = GoogleSignin.getCurrentUser();
      return currentUser !== null;
    } catch {
      return false;
    }
  }
}

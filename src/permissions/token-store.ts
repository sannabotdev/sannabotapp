/**
 * TokenStore – Encrypted storage for OAuth tokens, API keys and passwords
 * Uses react-native-keychain for secure Android Keystore storage.
 *
 * Biometric / device-PIN gate:
 *   A single "vault" entry is stored with
 *   ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE.
 *   Calling `authenticate()` reads that entry, which triggers the OS
 *   biometric / PIN prompt. All other credentials are stored in regular
 *   Keychain (hardware-encrypted) and only exposed after `authenticate()`
 *   sets `unlocked = true` for the current app session.
 */
import * as Keychain from 'react-native-keychain';

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp in ms
  tokenType?: string;
  scope?: string;
}

const TOKEN_SERVICE_PREFIX = 'sanna_token_';
const APIKEY_SERVICE_PREFIX = 'sanna_apikey_';
const PASSWORD_SERVICE_PREFIX = 'sanna_password_';
const VAULT_SERVICE = 'sanna_vault_lock';

export class TokenStore {
  /** Session flag – set to true after successful biometric / PIN auth */
  private unlocked = false;

  // ─── Biometric / PIN Gate ─────────────────────────────────────────────────

  /**
   * Ensure the vault entry exists (first-time setup).
   * Called once during init; creates the biometric-protected entry if missing.
   */
  async initVault(): Promise<void> {
    try {
      const existing = await Keychain.getGenericPassword({
        service: VAULT_SERVICE,
      });
      if (!existing) {
        await Keychain.setGenericPassword('vault', 'unlocked', {
          service: VAULT_SERVICE,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }
    } catch {
      // First access after setting biometric entry will also init it –
      // ignore errors here and let authenticate() handle them.
    }
  }

  /**
   * Prompt the user for biometric / device PIN.
   * Returns true if authentication succeeded, false otherwise.
   * On success, `unlocked` is set to true for this session.
   */
  async authenticate(promptTitle = 'Sanna entsperren'): Promise<boolean> {
    try {
      // Make sure the vault entry exists
      await this.initVault();

      const result = await Keychain.getGenericPassword({
        service: VAULT_SERVICE,
        authenticationPrompt: {
          title: promptTitle,
          subtitle: 'Fingerabdruck oder PIN eingeben',
          cancel: 'Abbrechen',
        },
      });

      if (result) {
        this.unlocked = true;
        return true;
      }
      return false;
    } catch {
      // User cancelled or biometrics failed
      return false;
    }
  }

  /** Check whether the vault is currently unlocked for this session. */
  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Lock the vault again (e.g. on app background). */
  lock(): void {
    this.unlocked = false;
  }

  /**
   * Unlock without biometric prompt – for headless background tasks only.
   *
   * Security rationale: The biometric gate is an *app-level* guard.
   * The actual Keychain entries (tokens, API keys) are stored without
   * biometric access control – only the special vault entry requires it.
   * In a headless context (AlarmManager → HeadlessJS) there is no UI for
   * a biometric prompt, but the Keychain entries are still hardware-encrypted
   * and only readable by this app's process.
   */
  unlockForHeadless(): void {
    this.unlocked = true;
  }

  /** Check if biometric / device passcode is available on this device. */
  async getBiometryType(): Promise<string | null> {
    const type = await Keychain.getSupportedBiometryType();
    return type;
  }

  // ─── Guard ────────────────────────────────────────────────────────────────

  private assertUnlocked(): void {
    if (!this.unlocked) {
      throw new Error('Vault ist gesperrt – bitte zuerst authentifizieren.');
    }
  }

  // ─── OAuth Tokens ──────────────────────────────────────────────────────────

  async saveOAuthToken(provider: string, token: OAuthToken): Promise<void> {
    this.assertUnlocked();
    await Keychain.setGenericPassword(
      provider,
      JSON.stringify(token),
      { service: TOKEN_SERVICE_PREFIX + provider },
    );
  }

  async getOAuthToken(provider: string): Promise<OAuthToken | null> {
    this.assertUnlocked();
    const result = await Keychain.getGenericPassword({
      service: TOKEN_SERVICE_PREFIX + provider,
    });
    if (!result) return null;
    try {
      return JSON.parse(result.password) as OAuthToken;
    } catch {
      return null;
    }
  }

  async deleteOAuthToken(provider: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: TOKEN_SERVICE_PREFIX + provider });
  }

  /** Check if token is expired (with 60s buffer) */
  isTokenExpired(token: OAuthToken): boolean {
    if (!token.expiresAt) return false;
    return Date.now() >= token.expiresAt - 60_000;
  }

  // ─── API Keys ──────────────────────────────────────────────────────────────

  async saveApiKey(id: string, key: string): Promise<void> {
    this.assertUnlocked();
    await Keychain.setGenericPassword(
      id,
      key,
      { service: APIKEY_SERVICE_PREFIX + id },
    );
  }

  async getApiKey(id: string): Promise<string | null> {
    this.assertUnlocked();
    const result = await Keychain.getGenericPassword({
      service: APIKEY_SERVICE_PREFIX + id,
    });
    return result ? result.password : null;
  }

  async deleteApiKey(id: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: APIKEY_SERVICE_PREFIX + id });
  }

  // ─── Passwords ─────────────────────────────────────────────────────────────

  async savePassword(id: string, username: string, password: string): Promise<void> {
    this.assertUnlocked();
    await Keychain.setGenericPassword(
      username,
      password,
      { service: PASSWORD_SERVICE_PREFIX + id },
    );
  }

  async getPassword(id: string): Promise<{ username: string; password: string } | null> {
    this.assertUnlocked();
    const result = await Keychain.getGenericPassword({
      service: PASSWORD_SERVICE_PREFIX + id,
    });
    if (!result) return null;
    return { username: result.username, password: result.password };
  }

  async deletePassword(id: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: PASSWORD_SERVICE_PREFIX + id });
  }

  // ─── Generic helpers ──────────────────────────────────────────────────────

  /** Check if a credential is stored (any type) – does NOT require unlock */
  async hasCredential(id: string): Promise<boolean> {
    const [token, apiKey, password] = await Promise.all([
      Keychain.getGenericPassword({ service: TOKEN_SERVICE_PREFIX + id }),
      Keychain.getGenericPassword({ service: APIKEY_SERVICE_PREFIX + id }),
      Keychain.getGenericPassword({ service: PASSWORD_SERVICE_PREFIX + id }),
    ]);
    return !!(token || apiKey || password);
  }

  /** Delete all credentials for a given id */
  async deleteCredential(id: string): Promise<void> {
    await Promise.all([
      Keychain.resetGenericPassword({ service: TOKEN_SERVICE_PREFIX + id }).catch(() => {}),
      Keychain.resetGenericPassword({ service: APIKEY_SERVICE_PREFIX + id }).catch(() => {}),
      Keychain.resetGenericPassword({ service: PASSWORD_SERVICE_PREFIX + id }).catch(() => {}),
    ]);
  }
}

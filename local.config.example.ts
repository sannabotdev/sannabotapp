/**
 * local.config.example.ts – Vorlage für lokale Dev-Konfiguration
 *
 * Kopiere diese Datei zu `local.config.ts` und trage deine Keys ein.
 * local.config.ts ist in .gitignore – kommt NIE ins Repository.
 *
 *   cp local.config.example.ts local.config.ts
 */
const LOCAL_DEV_CONFIG = {
  /** OpenAI API Key für lokale Entwicklung */
  openAIApiKey: '',

  /** Anthropic Claude API Key für lokale Entwicklung */
  claudeApiKey: '',

  /** Standard-Provider: 'claude' | 'openai' */
  selectedProvider: 'openai' as 'claude' | 'openai',

  /** OpenAI Modell (optional, Standard: 'gpt-5.2') */
  openAIModel: 'gpt-5.2',

  /** Claude Modell (optional, Standard: 'claude-sonnet-4-6') */
  claudeModel: 'claude-sonnet-4-6',

  /** Spotify Client ID für lokale Entwicklung */
  spotifyClientId: '',

  /** Google OAuth Web Client ID (aus Google Cloud Console) */
  googleWebClientId: '',

  /** Picovoice Access Key für lokale Entwicklung */
  picovoiceAccessKey: '',

  /** Slack Client ID für lokale Entwicklung */
  slackClientId: '',

  /**
   * Slack OAuth Redirect URL (HTTPS erforderlich – siehe DEV_SETUP.md).
   * Trage hier die URL deiner GitHub Pages Redirect-Seite ein.
   * Beispiel: 'https://deinname.github.io/sanna-oauth/slack'
   */
  slackRedirectUrl: '',
};

export default LOCAL_DEV_CONFIG;

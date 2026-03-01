/**
 * local.config.example.ts – Template for local dev configuration
 *
 * Copy this file to `local.config.ts` and fill in your keys.
 * local.config.ts is in .gitignore – NEVER committed to the repository.
 *
 *   cp local.config.example.ts local.config.ts
 */
const LOCAL_DEV_CONFIG = {
  /** OpenAI API Key for local development */
  openAIApiKey: '',

  /** Anthropic Claude API Key for local development */
  claudeApiKey: '',

  /** Default provider: 'claude' | 'openai' */
  selectedProvider: 'openai' as 'claude' | 'openai',

  /** OpenAI model (optional, default: 'gpt-5.2') */
  openAIModel: 'gpt-5.2',

  /** Claude model (optional, default: 'claude-sonnet-4-6') */
  claudeModel: 'claude-sonnet-4-6',

  /** Spotify Client ID for local development */
  spotifyClientId: '',

  /** Google OAuth Web Client ID (from Google Cloud Console) */
  googleWebClientId: '',

  /** Picovoice Access Key for local development */
  picovoiceAccessKey: '',

  /** Slack Client ID for local development */
  slackClientId: '',

  /**
   * Slack OAuth Redirect URL (HTTPS required – see DEVELOP.md).
   * Enter the URL of your GitHub Pages redirect page here.
   * Example: 'https://yourname.github.io/sanna-oauth/slack'
   */
  slackRedirectUrl: '',

  /** Google Maps API Key for local development */
  googleMapsApiKey: '',

  /** Enable debug logging by default (optional, default: false) */
  debugLogEnabled: false,
};

export default LOCAL_DEV_CONFIG;

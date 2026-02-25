# Development Setup – API Keys, Credentials & Building

First, copy the template:

```bash
cp local.config.example.ts local.config.ts
```

`local.config.ts` is in `.gitignore` – it will **never** be committed to the repository.

---

## 1. OpenAI API Key (`openAIApiKey`)

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **"Create new secret key"** → choose a name → copy the key
3. Format: `sk-proj-...`

> Cost: Pay-as-you-go. A few dollars of credit is enough for development.

---

## 2. Anthropic Claude API Key (`claudeApiKey`)

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. **"Create Key"** → choose a name → copy the key
3. Format: `sk-ant-...`

> Only required if `selectedProvider: 'claude'` is set.

---

## 3. Spotify Client ID (`spotifyClientId`)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. **"Create app"** → fill in name + description
3. Add redirect URI: `sannabot://spotify-callback`
4. **"Settings"** → copy the Client ID
5. Format: 32-character hex string, e.g. `1f1878d7b693496db8af569f5ea27b71`

> No Client Secret needed – the app uses PKCE.

---

## 4. Google Web Client ID (`googleWebClientId`)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select an existing project or create a new one
3. **"APIs & Services" → "Credentials"**
4. **"+ Create Credentials" → "OAuth client ID"**
   - Application type: **Web application**
   - Authorized redirect URIs: leave empty (managed by the Google Sign-In SDK)
5. Copy the Client ID
6. Format: `xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

**Also enable the required APIs** (under "APIs & Services → Library"):
- Gmail API
- Google Calendar API
- Google Tasks API
- Google People API (for contacts)

**Register the debug keystore SHA-1 fingerprint:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```
Enter the SHA-1 under **"APIs & Services → Credentials → OAuth 2.0 Client IDs → Android"**.

---

## 5. Picovoice Access Key (`picovoiceAccessKey`)

Required for the "Hey Sanna" wake word.

1. Go to [console.picovoice.ai](https://console.picovoice.ai/)
2. Create a free account
3. Copy the **"Access Key"** from the dashboard
4. Format: long Base64 string

> The free plan is sufficient for development.

---

## 6. Slack Client ID + Redirect URL (`slackClientId`, `slackRedirectUrl`)

Slack requires an **HTTPS URL** as redirect – custom schemes like `sannabot://` are rejected in the dashboard.
The solution: host a tiny redirect page (e.g. on GitHub Pages, free) that forwards the browser back to the app.

### 6a. Set up a redirect page on GitHub Pages

1. Create a new GitHub repository, e.g. `sanna-oauth` (can be public)

2. Create a file `slack/index.html` with the following content:

   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Redirecting…</title></head>
   <body>
   <script>
     // Redirect the OAuth callback back to the SannaBot app
     window.location.replace(
       'sannabot://slack-callback' + window.location.search
     );
   </script>
   <p>Redirecting to SannaBot app…</p>
   </body>
   </html>
   ```

3. In the repository go to **Settings → Pages → Source: Deploy from branch (main)**

4. Your redirect URL will be:
   ```
   https://YOUR-GITHUB-USER.github.io/sanna-oauth/slack
   ```

### 6b. Create the Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. **"Create New App" → "From scratch"**
3. Choose an app name, select your workspace
4. **"OAuth & Permissions" → "Redirect URLs" → "Add New Redirect URL"**:
   ```
   https://YOUR-GITHUB-USER.github.io/sanna-oauth/slack
   ```
5. Add **"User Token Scopes"**:

   | Scope | Purpose |
   |---|---|
   | `channels:history` | Read messages in public channels |
   | `channels:read` | List channels |
   | `chat:write` | Send messages |
   | `im:history` | Read direct messages |
   | `im:write` | Open direct messages |
   | `mpim:history` | Read group DMs |
   | `users:read` | List users |
   | `users:read.email` | Look up users by email |
   | `users.profile:write` | Set own status |

6. **"Basic Information" → "App Credentials" → Client ID** → copy it

### 6c. Add to `local.config.ts`

```typescript
slackClientId: '1234567890.abcdef...',
slackRedirectUrl: 'https://YOUR-GITHUB-USER.github.io/sanna-oauth/slack',
```

> No Client Secret needed – the app uses PKCE.

---

## Complete `local.config.ts`

```typescript
const LOCAL_DEV_CONFIG = {
  openAIApiKey: 'sk-proj-...',
  claudeApiKey: '',                    // leave empty if using OpenAI
  selectedProvider: 'openai' as 'claude' | 'openai',
  spotifyClientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  googleWebClientId: 'xxxxxxxxxx-xxx.apps.googleusercontent.com',
  picovoiceAccessKey: 'xxxxx...==',
  slackClientId: 'xxxxxxxxxxx.xxxxxxxxxxx',
  slackRedirectUrl: 'https://your-github-user.github.io/sanna-oauth/slack',
};

export default LOCAL_DEV_CONFIG;
```

---

## 🛠️ Development Workflow

The project includes several npm/pnpm scripts to streamline development:

### Start Metro Bundler

```bash
pnpm start
# or
npm start
```

Starts the React Native Metro bundler. Keep this running in a separate terminal during development.

### Run on Android Device/Emulator

```bash
# Debug build
pnpm android
# or
npm run android

# Release build
pnpm android:release
# or
npm run android:release
```

Builds and installs the app on a connected Android device or emulator. The debug build includes development tools and hot reloading.

### View Logs

```bash
pnpm logcat
# or
npm run logcat
```

Clears and displays Android logcat output, filtered to show React Native JavaScript logs. Useful for debugging runtime issues.

### Typical Development Flow

1. Start Metro bundler in one terminal:
   ```bash
   pnpm start
   ```

2. In another terminal, run the app:
   ```bash
   pnpm android
   ```

3. For debugging, open a third terminal for logs:
   ```bash
   pnpm logcat
   ```

---

## 📲 Building an APK

**Debug APK** (for testing):

```bash
cd android
./gradlew assembleDebug
```

The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

**Release APK** (optimized, minified):

```bash
cd android
./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/release/app-release.apk`.

> **Note:** The release build currently uses the debug keystore. For production distribution, [generate your own keystore](https://reactnative.dev/docs/signed-apk-android) and update `android/app/build.gradle`.

You can also build and run directly on a connected device:

```bash
# Debug
npm run android

# Release
npm run android:release
```

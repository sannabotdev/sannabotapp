# Dev Setup – API Keys & Credentials

Kopiere zuerst die Vorlage:

```bash
cp local.config.example.ts local.config.ts
```

`local.config.ts` ist in `.gitignore` – kommt **nie** ins Repository.

---

## 1. OpenAI API Key (`openAIApiKey`)

1. Gehe zu [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **"Create new secret key"** → Namen vergeben → Key kopieren
3. Format: `sk-proj-...`

> Kosten: Pay-as-you-go. Für Entwicklung reichen ein paar Dollar Guthaben.

---

## 2. Anthropic Claude API Key (`claudeApiKey`)

1. Gehe zu [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. **"Create Key"** → Namen vergeben → Key kopieren
3. Format: `sk-ant-...`

> Nur nötig wenn `selectedProvider: 'claude'` gesetzt ist.

---

## 3. Spotify Client ID (`spotifyClientId`)

1. Gehe zu [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. **"Create app"** → Name + Beschreibung ausfüllen
3. Redirect URI hinzufügen: `sannabot://spotify-callback`
4. **"Settings"** → Client ID kopieren
5. Format: 32-stelliger Hex-String, z.B. `1f1878d7b693496db8af569f5ea27b71`

> Kein Client Secret nötig – die App verwendet PKCE.

---

## 4. Google Web Client ID (`googleWebClientId`)

1. Gehe zu [console.cloud.google.com](https://console.cloud.google.com)
2. Projekt auswählen oder neu erstellen
3. **"APIs & Dienste" → "Anmeldedaten"**
4. **"+ Anmeldedaten erstellen" → "OAuth-Client-ID"**
   - Anwendungstyp: **Web-Anwendung**
   - Autorisierte Weiterleitungs-URIs: leer lassen (wird von Google Sign-In SDK verwaltet)
5. Client-ID kopieren
6. Format: `xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

**Außerdem benötigte APIs aktivieren** (unter "APIs & Dienste → Bibliothek"):
- Gmail API
- Google Calendar API
- Google Tasks API
- Google People API (für Kontakte)

**SHA-1 Fingerprint der Debug-Keystore eintragen:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```
Den SHA-1 unter **"APIs & Dienste → Anmeldedaten → OAuth 2.0-Client-IDs → Android"** eintragen.

---

## 5. Picovoice Access Key (`picovoiceAccessKey`)

Wird für das Wake-Word "Hey Sanna" benötigt.

1. Gehe zu [console.picovoice.ai](https://console.picovoice.ai/)
2. Kostenlosen Account erstellen
3. **"Access Key"** im Dashboard kopieren
4. Format: langer Base64-String

> Der kostenlose Plan reicht für die Entwicklung.

---

## 6. Slack Client ID + Redirect URL (`slackClientId`, `slackRedirectUrl`)

Slack verlangt eine **HTTPS-URL** als Redirect – Custom-Schemes wie `sannabot://` werden im Dashboard abgelehnt.
Die Lösung: eine winzige Redirect-Seite hosten (z.B. GitHub Pages, kostenlos), die den Browser zurück zur App weiterleitet.

### 6a. Redirect-Seite auf GitHub Pages einrichten

1. Neues GitHub-Repository anlegen, z.B. `sanna-oauth` (kann public sein)

2. Datei `slack/index.html` anlegen mit folgendem Inhalt:

   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Redirecting…</title></head>
   <body>
   <script>
     // Leite den OAuth-Callback zurück zur SannaBot-App weiter
     window.location.replace(
       'sannabot://slack-callback' + window.location.search
     );
   </script>
   <p>Weiterleitung zur SannaBot-App…</p>
   </body>
   </html>
   ```

3. Im Repository **Settings → Pages → Source: Deploy from branch (main)**

4. Deine Redirect-URL lautet dann:
   ```
   https://DEIN-GITHUB-USER.github.io/sanna-oauth/slack
   ```

### 6b. Slack App anlegen

1. Gehe zu [api.slack.com/apps](https://api.slack.com/apps)
2. **"Create New App" → "From scratch"**
3. App-Name vergeben, Workspace auswählen
4. **"OAuth & Permissions" → "Redirect URLs" → "Add New Redirect URL"**:
   ```
   https://DEIN-GITHUB-USER.github.io/sanna-oauth/slack
   ```
5. **"User Token Scopes"** hinzufügen:

   | Scope | Zweck |
   |---|---|
   | `channels:history` | Nachrichten in öffentlichen Channels lesen |
   | `channels:read` | Channel-Liste abrufen |
   | `chat:write` | Nachrichten senden |
   | `im:history` | Direktnachrichten lesen |
   | `im:write` | Direktnachrichten öffnen |
   | `mpim:history` | Gruppen-DMs lesen |
   | `users:read` | Nutzer auflisten |
   | `users:read.email` | Nutzer per E-Mail suchen |
   | `users.profile:write` | Eigenen Status setzen |

6. **"Basic Information" → "App Credentials" → Client ID** kopieren

### 6c. In `local.config.ts` eintragen

```typescript
slackClientId: '1234567890.abcdef...',
slackRedirectUrl: 'https://DEIN-GITHUB-USER.github.io/sanna-oauth/slack',
```

> Kein Client Secret nötig – die App verwendet PKCE.

---

## Fertige `local.config.ts`

```typescript
const LOCAL_DEV_CONFIG = {
  openAIApiKey: 'sk-proj-...',
  claudeApiKey: '',                    // leer lassen wenn OpenAI verwendet wird
  selectedProvider: 'openai' as 'claude' | 'openai',
  spotifyClientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  googleWebClientId: 'xxxxxxxxxx-xxx.apps.googleusercontent.com',
  picovoiceAccessKey: 'xxxxx...==',
  slackClientId: 'xxxxxxxxxxx.xxxxxxxxxxx',
  slackRedirectUrl: 'https://dein-github-user.github.io/sanna-oauth/slack',
};

export default LOCAL_DEV_CONFIG;
```

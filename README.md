# 🎤 Sanna – Voice-First AI Assistant for Android

**What OpenClaw does for your desktop, Sanna does for your phone.**

An open-source AI assistant that runs on Android and actually *controls* your phone – not just talks about it. Powered by an LLM agent loop (OpenAI or Claude) that reasons, chains actions, and executes tools until the job is done.

> "Hey Sanna, read my last 3 emails, summarize them, and text the summary to Sarah" — just works.

## ✨ Highlights

- **🗣️ Voice-first** – Wake word ("Hey Sanna") → Speech-to-Text → LLM agent → Text-to-Speech, fully hands-free
- **📝 Skills are Markdown** – Drop a `SKILL.md` in a folder, the agent learns a new capability. No code changes.
- **🔄 Agentic tool loop** – LLM → tool call → result → back to LLM, until final answer. Multi-step reasoning out of the box.
- **⏰ Sub-agent scheduler** – Schedule natural-language tasks ("Every Monday at 9am, brief me on today's calendar via SMS"). A real LLM executes them – not a dumb cron job.
- **🚗 Driving mode** – Short spoken responses, auto-reads incoming notifications, optimized for hands-free use.
- **🔒 No backend needed** – OAuth flows use PKCE. All data stays on your device.

## 📦 12 Built-in Skills

| Skill | What it does |
|-------|-------------|
| 📧 Gmail | Read, search, send, and reply to emails |
| 📅 Calendar | Query and create Google Calendar events |
| ✅ Google Tasks | Manage task lists and items |
| 💬 Slack | Read/send messages, manage DMs, set status |
| 🎵 Spotify | Playback control via Web API |
| 📱 WhatsApp | Send messages via Android Intents |
| 💬 SMS | Send SMS directly in the background |
| 📞 Phone | Make calls |
| 👤 Contacts | Search and query contacts |
| 🗺️ Google Maps | Start navigation |
| 🔔 Notifications | Intercept & summarize notifications from any app |
| ⏰ Scheduler | Autonomous scheduled tasks with sub-agents |

## 🏗️ Architecture

```
Wake Word (Picovoice) → STT → LLM Agent Loop → Tool Execution → TTS
                                    ↕
                           SKILL.md files (auto-discovered)
                                    ↕
                         Tools: intent, http, tts, device,
                         sms, query, scheduler, notifications
```

- **React Native** + native **Kotlin** modules for Android-specific features
- **LLM providers**: OpenAI (`gpt-4o`) or Anthropic Claude – swap with one config line
- **Skill auto-discovery**: Metro's `require.context()` scans `assets/skills/*/SKILL.md` at build time
- **OAuth2 PKCE**: Google, Spotify, Slack – no server, no client secret

## 🚀 Quick Start

1. Clone the repo
2. `cp local.config.example.ts local.config.ts` and add your API keys
3. `npm install && npm run android`

See [DEV_SETUP.md](DEV_SETUP.md) for detailed credential setup (API keys, OAuth, etc.).

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

## 🤝 Adding a Skill

Create `assets/skills/your-skill/SKILL.md`:

```markdown
---
name: your-skill
description: What this skill does
---
# Your Skill

## Tool: http

### Do something

```json
{
  "method": "GET",
  "url": "https://api.example.com/endpoint",
  "auth_provider": "google"
}
```

That's it. No code changes. The agent picks it up automatically.

## 📄 License

MIT

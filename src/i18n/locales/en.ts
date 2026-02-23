/**
 * English translations (default / fallback locale)
 */
const en = {
  // ── App / Lock Screen ────────────────────────────────────────────────────
  'app.loading': 'Unlocking Sanna…',
  'app.locked.title': 'Sanna is locked',
  'app.locked.subtitle': 'Unlock with fingerprint or PIN to access your keys and tokens.',
  'app.locked.button': '🔓 Unlock',
  'app.locked.authError': 'Authentication failed. Please try again.',

  // ── Alerts ───────────────────────────────────────────────────────────────
  'alert.error': 'Error',
  'alert.noApiKey.title': 'No API Key',
  'alert.noApiKey.message': 'Please enter an API key in Settings.',
  'alert.micPermission.title': 'Microphone permission missing',
  'alert.micPermission.message': 'Sanna needs access to the microphone.',
  'alert.sttError': 'STT Error',
  'alert.permissionMissing.title': 'Permission missing',
  'alert.permissionMissing.message': "The \"{skillName}\" skill requires the following permissions:\n{permissions}",

  // ── Home Screen ───────────────────────────────────────────────────────────
  'home.state.idle': 'Ready',
  'home.state.listening': 'Listening…',
  'home.state.processing': 'Thinking…',
  'home.state.speaking': 'Speaking…',
  'home.state.error': 'Error',

  'home.mode.driving': '🚗 Driving',
  'home.mode.normal': '🏠 Normal',

  'home.empty.title': 'Sanna AI Assistant',
  'home.empty.subtitle': 'Type a message or press the microphone',

  'home.driving.tapToStop': 'Tap to stop',
  'home.driving.thinking': 'Thinking…',
  'home.driving.speaking': 'Speaking…',
  'home.driving.micOn': 'Microphone on',
  'home.driving.tapMic': 'Tap the microphone to speak',
  'home.thinking': 'Sanna is thinking…',

  'home.input.placeholder': 'Type a message…',

  'home.bubble.user': '👤 You',
  'home.bubble.assistant': 'Sanna',

  // ── Settings ─────────────────────────────────────────────────────────────
  'settings.back': '← Back',
  'settings.title': 'Settings',

  'settings.section.provider': 'AI Provider',
  'settings.section.wakeWord': 'Wake Word',
  'settings.section.language': 'Language',
  'settings.section.skills': 'Skills',
  'settings.section.about': 'About',

  // Provider
  'settings.provider.claudeModel': 'Claude Model',
  'settings.provider.openaiModel': 'OpenAI Model',
  'settings.provider.loadingModels': 'Loading models…',

  // Wake Word
  'settings.wakeWord.label': "Activate 'Hey Sanna'",
  'settings.wakeWord.description': 'Listens permanently for the wake word',
  'settings.wakeWord.keyLabel': 'Picovoice Access Key',

  // Language / Speech
  'settings.language.label': 'App Language',
  'settings.language.description': 'App language and speech recognition',
  'settings.language.pickTitle': 'Select Language',
  'settings.language.system': 'System Default',

  'settings.speech.modeLabel': 'Mode',
  'settings.speech.mode.auto': 'Auto',
  'settings.speech.mode.auto.desc': 'Cloud first, on-device fallback',
  'settings.speech.mode.offline': 'Offline',
  'settings.speech.mode.offline.desc': 'On-device only',
  'settings.speech.mode.online': 'Online',
  'settings.speech.mode.online.desc': 'Cloud only',

  // Skills
  'settings.skills.filterLabel': 'Show only available skills',
  'settings.skills.filterDesc': 'Hides skills whose app is not installed or not configured',
  'settings.skills.badge.notInstalled': 'Not installed',
  'settings.skills.badge.notConfigured': 'Not configured',
  'settings.skills.badge.connected': '● Connected',
  'settings.skills.badge.setupNeeded': '○ Setup needed',
  'settings.skills.requires': 'Requires: {package}',
  'settings.skills.clientIdMissing': 'Client ID missing – see DEV_SETUP.md',
  'settings.skills.button.connect': 'Connect',
  'settings.skills.button.disconnect': 'Disconnect',
  'settings.skills.button.test': 'Test',
  'settings.skills.button.testing': 'Testing…',
  'settings.skills.testResult.ok': '✓ OK',
  'settings.skills.testResult.error': '✗ Error',
  'settings.skills.notification.checking': 'Checking permission…',
  'settings.skills.notification.granted': 'Notification access granted',
  'settings.skills.notification.denied': 'Notification access not granted',
  'settings.skills.notification.allowButton': 'Allow access',
  'settings.skills.disconnect.title': 'Disconnect {name}?',
  'settings.skills.disconnect.message': 'The saved credentials will be deleted.',
  'settings.skills.disconnect.cancel': 'Cancel',
  'settings.skills.disconnect.confirm': 'Disconnect',
  'settings.skills.connectError.title': 'Connection failed',

  // Evidence Modal
  'evidence.noDetails': 'No details available',
  'evidence.close': 'Close',

  // Debug Panel
  'debug.title': '🐛 Debug Log',
  'debug.clear': 'Clear',
  'debug.close': '✕ Close',
  'debug.empty': 'No logs yet. Send a message to get started.',
  'debug.truncated': '… (truncated)',
  'debug.tapForMore': 'Tap again for full content',

  // Skill Test Evidence
  'evidence.iterations': 'Iterations: {count}',
  'evidence.toolCalls': '━━━ Tool Calls ━━━',
  'evidence.toolResults': '━━━ Tool Results ━━━',
  'evidence.finalResponse': '━━━ Final Response ━━━',
  'evidence.truncatedLines': '   ...',
  'evidence.success': '✓ Test passed',
  'evidence.failure': '✗ Test failed',

  // TTS test results (spoken)
  'test.tts.success': 'Test successful.',
  'test.tts.failed': 'Test failed.',
  'test.tts.iterations': '{count} iterations completed.',

  // Notification access error
  'notification.settingsError': 'Could not open settings',

  // Service Client ID change confirmation
  'alert.serviceClientIdChanged.title': 'Disconnect service?',
  'alert.serviceClientIdChanged.message': 'Changing the {provider} Client ID will invalidate the existing connection. You will need to reconnect the service afterwards.',
  'alert.serviceClientIdChanged.cancel': 'Cancel',
  'alert.serviceClientIdChanged.confirm': 'Change & disconnect',

  // Services / OAuth Client IDs
  'settings.section.services': 'Services & OAuth',
  'settings.services.intro': 'Configure the OAuth client IDs required for Google, Spotify and Slack integrations, as well as the Picovoice key for wake-word detection.',
  'settings.services.google.label': 'Google Web Client ID',
  'settings.services.google.instructions': 'Create an OAuth 2.0 client (type: Web) in the Google Cloud Console → APIs & Services → Credentials. Copy the Client ID (ends with .apps.googleusercontent.com) and paste it here.\n\nRequired APIs (enable under APIs & Services → Library):\n• Google Calendar API\n• Google People API (for Contacts)\n• Google Tasks API\n• Gmail API',
  'settings.services.spotify.label': 'Spotify Client ID',
  'settings.services.spotify.instructions': 'Open the Spotify Developer Dashboard (developer.spotify.com), create a new app, and copy the Client ID shown on the app overview page.',
  'settings.services.picovoice.label': 'Picovoice Access Key',
  'settings.services.picovoice.instructions': 'Sign up at console.picovoice.ai and copy your Access Key from the dashboard. Required for the "Hey Sanna" wake-word feature.',
  'settings.services.slack.label': 'Slack Client ID',
  'settings.services.slack.instructions': 'Create a Slack app at api.slack.com/apps, enable OAuth & Permissions, and copy the Client ID from the "Basic Information" page.',
} as const;

export default en;

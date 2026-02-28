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
  'app.onboarding.skillHint': 'Welcome! 👋 Some skills (e.g. Phone, SMS, Google Maps) need extra permissions and are disabled by default. Go to **Settings → Skills** to enable them.',

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

  'home.driving.tapToStop': 'Stop',
  'home.driving.thinking': 'Thinking…',
  'home.driving.speaking': 'Speaking…',
  'home.driving.micOn': 'Microphone on',
  'home.driving.tapMic': 'Tap the microphone to speak',
  'home.thinking': 'Sanna is thinking…',
  'home.loadingHistory': 'Loading conversation…',

  'home.input.placeholder': 'Type a message…',

  'home.bubble.user': '👤 You',
  'home.bubble.assistant': 'Sanna',

  // ── Settings ─────────────────────────────────────────────────────────────
  'settings.back': '← Back',
  'settings.title': 'Settings',

  'settings.section.provider': 'AI Provider',
  'settings.section.wakeWord': 'Wake Word',
  'settings.section.language': 'Language',
  'settings.section.soul': 'Persona',
  'settings.section.skills': 'Skills',
  'settings.section.about': 'About',

  // Data management
  'settings.clearHistory.button': 'Clear Conversation History',
  'settings.clearHistory.description': 'Deletes all messages from the chat and the LLM memory.',
  'settings.clearHistory.confirm.title': 'Clear conversation?',
  'settings.clearHistory.confirm.message': 'All messages and the conversation memory will be permanently deleted.',
  'settings.clearHistory.confirm.cancel': 'Cancel',
  'settings.clearHistory.confirm.confirm': 'Clear',
  'settings.clearHistory.done': 'Conversation history cleared.',

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

  // SOUL
  'settings.soul.description': 'Define Sanna\'s personality and tone.',
  'settings.soul.dictate': 'Dictate',
  'settings.soul.clear': 'Clear',
  'settings.soul.clearConfirm': 'Delete all text?',
  'settings.soul.placeholder': 'Write your instructions here...',
  'settings.persona.memory.description': 'Personal Facts (like name, family, work, location, hobbies, favorites).',
  'settings.persona.memory.placeholder': 'Write personal facts as short bullet points or lines...',
  'settings.persona.memory.clear': 'Clear memory',
  'settings.persona.memory.clearConfirm': 'Delete all personal memory text?',

  // Skills
  'settings.skills.filterLabel': 'Show only available skills',
  'settings.skills.filterDesc': 'Hides skills whose app is not installed or not configured',
  'settings.skills.badge.notInstalled': 'Not installed',
  'settings.skills.badge.notConfigured': 'Not configured',
  'settings.skills.badge.connected': '● Connected',
  'settings.skills.badge.setupNeeded': '○ Setup needed',
  'settings.skills.requires': 'Requires: {package}',
  'settings.skills.clientIdMissing': 'Client ID missing – see DEVELOP.md',
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

  // Skill categories
  'settings.skills.category.communication': 'Communication',
  'settings.skills.category.productivity': 'Productivity',
  'settings.skills.category.information': 'Information',
  'settings.skills.category.media': 'Media',
  'settings.skills.category.other': 'Other',

  // Evidence Modal
  'evidence.noDetails': 'No details available',
  'evidence.close': 'Close',

  // Debug Panel
  'debug.title': '🪲 Debug Log',
  'debug.clear': 'Clear',
  'debug.close': '✕ Close',
  'debug.download': '📥 Download',
  'debug.empty': 'No logs yet. Send a message to get started.',
  'debug.filter.empty': 'No entries for "{level}"',
  'debug.truncated': '… (truncated)',
  'debug.tapForMore': 'Tap again for full content',
  'debug.shareError.title': 'Unable to Share',
  'debug.shareError.message.generic': 'Failed to open the share dialog. The log may be too large or no sharing apps are available.',
  'debug.shareError.message.noApps': 'No apps available to share. Please install a file manager or messaging app.',
  'debug.shareError.ok': 'OK',
  'debug.fileSaved.title': 'File Saved',
  'debug.fileSaved.message': 'The debug log was saved as a file because it is too large to share.\n\nFilename: {filename}\nLocation: {path}\nSize: {size} MB',
  'debug.fileSaved.ok': 'OK',
  'debug.fileSaveError.title': 'Save Error',
  'debug.fileSaveError.message': 'The file could not be saved. Please check permissions.',
  'debug.fileSaveError.ok': 'OK',

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

  // Agent Iterations
  'settings.section.agent': 'Agent Iterations',
  'settings.agent.description': 'Sets how many rounds the LLM may run per request before stopping.',
  'settings.agent.mainLabel': 'Main Agent',
  'settings.agent.mainDesc': 'Conversation Pipeline (Normal & Driving Mode)',
  'settings.agent.subLabel': 'Sub-Agent (App Rules & Scheduler)',
  'settings.agent.subDesc': 'App Rules and Scheduler Sub-Agents',
  'settings.agent.accessibilityLabel': 'Accessibility Sub-Agent',
  'settings.agent.accessibilityDesc': 'UI Automation (controlling apps)',
  'settings.agent.validationError': 'Please enter a value between 6 and 50',

  // History
  'settings.section.history': 'History',
  'settings.history.description': 'Configure LLM context history and persisted conversation history independently.',
  'settings.history.llmContextLabel': 'LLM Context History',
  'settings.history.llmContextDesc': 'Messages kept in prompt context (10–200)',
  'settings.history.conversationHistoryLabel': 'Conversation History',
  'settings.history.conversationHistoryDesc': 'Messages stored/shown in chat history (50–200)',

  // Avatar Menu
  'menu.settings': 'Settings',
  'menu.debug': 'Debug Log',
  'menu.darkMode.dark': 'Light Mode',
  'menu.darkMode.light': 'Dark Mode',
  'menu.lists': 'Lists',
  'menu.scheduler': 'Schedules',
  'menu.notificationListeners': 'App Rules',

  // Lists Screen
  'lists.title': 'Lists',
  'lists.empty': 'No lists found.\nCreate a list by telling Sanna e.g. "Add milk to the shopping list"',
  'lists.item.singular': 'item',
  'lists.item.plural': 'items',
  'lists.editMode.button': 'Edit',
  'lists.editMode.done': 'Done',
  'lists.deleteList.button': 'Delete list',
  'lists.items.empty': 'List is empty',
  'lists.delete.title': 'Delete list',
  'lists.delete.message': 'Really delete this list?',
  'lists.delete.cancel': 'Cancel',
  'lists.delete.confirm': 'Delete',

  // Schedules Screen
  'schedules.title': 'Schedules',
  'schedules.empty': 'No scheduled tasks found.\nCreate one by telling Sanna e.g. "Remind me tomorrow at 9 am…"',
  'schedules.detail.label': 'Label',
  'schedules.detail.instruction': 'Instruction',
  'schedules.detail.triggerAt': 'Runs at',
  'schedules.detail.recurrence': 'Recurrence',
  'schedules.detail.status': 'Status',
  'schedules.detail.createdAt': 'Created',
  'schedules.detail.lastExecuted': 'Last run',
  'schedules.status.active': '✅ Active',
  'schedules.status.disabled': '⏸️ Disabled',
  'schedules.deleteButton': 'Delete entry',
  'schedules.delete.title': 'Delete entry?',
  'schedules.delete.message': 'Really delete this scheduled task?',
  'schedules.delete.cancel': 'Cancel',
  'schedules.delete.confirm': 'Delete',
  'schedules.recurrence.once': 'One-time',
  'schedules.recurrence.interval.minutes': 'Every {count} minutes',
  'schedules.recurrence.interval.hours': 'Every {hours} hours',
  'schedules.recurrence.interval.hoursMinutes': 'Every {hours}h {minutes}min',
  'schedules.recurrence.daily': 'Daily at {time}',
  'schedules.recurrence.weekly': 'Weekly {days} at {time}',

  // App Rules Screen (formerly Notification Listeners)
  'notifListeners.title': 'App Rules',
  'notifListeners.empty': 'No app rules found.\nCreate one by telling Sanna e.g. "Read me WhatsApp messages aloud"',
  'notifListeners.detail.app': 'App',
  'notifListeners.detail.instruction': 'Instruction',
  'notifListeners.detail.condition': 'Condition',
  'notifListeners.detail.conditionAlways': '(always trigger)',
  'notifListeners.detail.status': 'Status',
  'notifListeners.detail.createdAt': 'Created',
  'notifListeners.status.active': '✅ Active',
  'notifListeners.status.disabled': '⏸️ Disabled',
  'notifListeners.deleteButton': 'Delete rule',
  'notifListeners.delete.title': 'Delete rule?',
  'notifListeners.delete.message': 'Really delete this app rule?',
  'notifListeners.delete.cancel': 'Cancel',
  'notifListeners.delete.confirm': 'Delete',

  // Accessibility Hints Modal
  'accessibilityHints.button': 'Manage Accessibility Hints',
  'accessibilityHints.buttonDesc': 'Stored learning data for app automations',
  'accessibilityHints.title': 'Accessibility Hints',
  'accessibilityHints.empty': 'No hints stored yet.\nHints are created automatically after app automations.',
  'accessibilityHints.close': 'Close',
  'accessibilityHints.deleteButton': 'Delete hints',
  'accessibilityHints.delete.title': 'Delete hints?',
  'accessibilityHints.delete.message': 'Really delete the stored hints for this app?',
  'accessibilityHints.delete.cancel': 'Cancel',
  'accessibilityHints.delete.confirm': 'Delete',

  // Services / OAuth Client IDs
  'settings.section.services': 'Services & OAuth',
  'settings.services.intro': 'Configure the OAuth client IDs required for Google, Spotify and Slack integrations, as well as the Picovoice key for wake-word detection.',
  'settings.services.configured': '● Configured',
  'settings.services.notConfigured': '○ Not configured',
  'settings.services.hideInstructions': 'Hide instructions',
  'settings.services.showInstructions': 'How to get this key',
  'settings.services.google.label': 'Google Web Client ID',
  'settings.services.google.instructions': 'Create an OAuth 2.0 client (type: Web) in the Google Cloud Console → APIs & Services → Credentials. Copy the Client ID (ends with .apps.googleusercontent.com) and paste it here.\n\nRequired APIs (enable under APIs & Services → Library):\n• Google Calendar API\n• Google People API (for Contacts)\n• Google Tasks API\n• Gmail API',
  'settings.services.spotify.label': 'Spotify Client ID',
  'settings.services.spotify.instructions': 'Open the Spotify Developer Dashboard (developer.spotify.com), create a new app, and copy the Client ID shown on the app overview page.',
  'settings.services.picovoice.label': 'Picovoice Access Key',
  'settings.services.picovoice.instructions': 'Sign up at console.picovoice.ai and copy your Access Key from the dashboard. Required for the "Hey Sanna" wake-word feature.',
  'settings.services.slack.label': 'Slack Client ID',
  'settings.services.slack.instructions': 'Create a Slack app at api.slack.com/apps, enable OAuth & Permissions, and copy the Client ID from the "Basic Information" page.',
  'settings.services.googleMaps.label': 'Google Maps API Key',
  'settings.services.googleMaps.instructions': 'Go to the Google Cloud Console (console.cloud.google.com), create an API key under "APIs & Services → Credentials → Create Credentials → API key".\n\nEnable these APIs under "APIs & Services → Library":\n• Routes API (for route/traffic information)\n• Geocoding API (for address lookup)\n\nOptional: Restrict the key to these APIs for security.',
} as const;

export default en;

/**
 * German translations
 */
const de = {
  // ── App / Lock Screen ────────────────────────────────────────────────────
  'app.loading': 'Sanna wird entsperrt…',
  'app.locked.title': 'Sanna ist gesperrt',
  'app.locked.subtitle': 'Entsperre mit Fingerabdruck oder PIN, um auf deine Keys und Tokens zuzugreifen.',
  'app.locked.button': '🔓 Entsperren',
  'app.locked.authError': 'Authentifizierung fehlgeschlagen. Versuche es erneut.',
  'app.onboarding.skillHint': 'Willkommen! 👋 Einige Skills (z.\u00A0B. Telefon, SMS, Google Maps) benötigen zusätzliche Berechtigungen und sind standardmäßig deaktiviert. Gehe zu **Einstellungen → Skills**, um sie zu aktivieren.',

  // ── Alerts ───────────────────────────────────────────────────────────────
  'alert.error': 'Fehler',
  'alert.noApiKey.title': 'Kein API Key',
  'alert.noApiKey.message': 'Bitte gib einen API Key in den Einstellungen ein.',
  'alert.micPermission.title': 'Mikrofon-Berechtigung fehlt',
  'alert.micPermission.message': 'Sanna benötigt Zugriff auf das Mikrofon.',
  'alert.sttError': 'STT Fehler',
  'alert.permissionMissing.title': 'Berechtigung fehlt',
  'alert.permissionMissing.message': 'Für den \"{skillName}\" Skill werden folgende Berechtigungen benötigt:\n{permissions}',

  // ── Home Screen ───────────────────────────────────────────────────────────
  'home.state.idle': 'Bereit',
  'home.state.listening': 'Höre zu…',
  'home.state.processing': 'Denke…',
  'home.state.speaking': 'Spreche…',
  'home.state.error': 'Fehler',

  'home.mode.driving': '🚗 Fahren',
  'home.mode.normal': '🏠 Normal',

  'home.empty.title': 'Sanna KI-Assistent',
  'home.empty.subtitle': 'Tippe eine Nachricht oder drücke das Mikrofon',

  'home.driving.tapToStop': 'Tippen zum Stoppen',
  'home.driving.thinking': 'Denke…',
  'home.driving.speaking': 'Spreche…',
  'home.driving.micOn': 'Mikrofon an',
  'home.driving.tapMic': 'Tippe auf Mikrofon um zu sprechen',
  'home.thinking': 'Sanna denkt…',
  'home.loadingHistory': 'Gespräch wird geladen…',

  'home.input.placeholder': 'Nachricht eingeben…',

  'home.bubble.user': '👤 Du',
  'home.bubble.assistant': 'Sanna',

  // ── Settings ─────────────────────────────────────────────────────────────
  'settings.back': '← Zurück',
  'settings.title': 'Einstellungen',

  'settings.section.provider': 'KI-Anbieter',
  'settings.section.wakeWord': 'Wake Word',
  'settings.section.language': 'Sprache',
  'settings.section.skills': 'Skills',
  'settings.section.about': 'Über Sanna',

  // Datenverwaltung
  'settings.clearHistory.button': 'Gesprächsverlauf löschen',
  'settings.clearHistory.description': 'Löscht alle Nachrichten aus dem Chat und dem LLM-Gedächtnis.',
  'settings.clearHistory.confirm.title': 'Gespräch löschen?',
  'settings.clearHistory.confirm.message': 'Alle Nachrichten und das Gesprächsgedächtnis werden unwiderruflich gelöscht.',
  'settings.clearHistory.confirm.cancel': 'Abbrechen',
  'settings.clearHistory.confirm.confirm': 'Löschen',
  'settings.clearHistory.done': 'Gesprächsverlauf gelöscht.',

  // Provider
  'settings.provider.claudeModel': 'Claude Modell',
  'settings.provider.openaiModel': 'OpenAI Modell',
  'settings.provider.loadingModels': 'Lade Modelle…',

  // Wake Word
  'settings.wakeWord.label': "'Hey Sanna' aktivieren",
  'settings.wakeWord.description': 'Hört permanent auf das Wake Word',
  'settings.wakeWord.keyLabel': 'Picovoice Access Key',

  // Language / Speech
  'settings.language.label': 'App-Sprache',
  'settings.language.description': 'App-Sprache und Spracherkennung',
  'settings.language.pickTitle': 'Sprache auswählen',
  'settings.language.system': 'System-Standard',

  'settings.speech.modeLabel': 'Modus',
  'settings.speech.mode.auto': 'Auto',
  'settings.speech.mode.auto.desc': 'Cloud zuerst, Fallback On-Device',
  'settings.speech.mode.offline': 'Offline',
  'settings.speech.mode.offline.desc': 'Nur On-Device Erkennung',
  'settings.speech.mode.online': 'Online',
  'settings.speech.mode.online.desc': 'Nur Cloud-basiert',

  // Skills
  'settings.skills.filterLabel': 'Nur verfügbare Skills anzeigen',
  'settings.skills.filterDesc': 'Blendet Skills aus, deren App nicht installiert oder nicht konfiguriert ist',
  'settings.skills.badge.notInstalled': 'Nicht installiert',
  'settings.skills.badge.notConfigured': 'Nicht konfiguriert',
  'settings.skills.badge.connected': '● Verbunden',
  'settings.skills.badge.setupNeeded': '○ Setup nötig',
  'settings.skills.requires': 'Benötigt: {package}',
  'settings.skills.clientIdMissing': 'Client-ID fehlt – siehe DEVELOP.md',
  'settings.skills.button.connect': 'Verbinden',
  'settings.skills.button.disconnect': 'Trennen',
  'settings.skills.button.test': 'Testen',
  'settings.skills.button.testing': 'Test läuft…',
  'settings.skills.testResult.ok': '✓ OK',
  'settings.skills.testResult.error': '✗ Fehler',
  'settings.skills.notification.checking': 'Prüfe Berechtigung…',
  'settings.skills.notification.granted': 'Benachrichtigungszugriff erteilt',
  'settings.skills.notification.denied': 'Benachrichtigungszugriff nicht erteilt',
  'settings.skills.notification.allowButton': 'Zugriff erlauben',
  'settings.skills.disconnect.title': '{name} trennen?',
  'settings.skills.disconnect.message': 'Die gespeicherten Zugangsdaten werden gelöscht.',
  'settings.skills.disconnect.cancel': 'Abbrechen',
  'settings.skills.disconnect.confirm': 'Trennen',
  'settings.skills.connectError.title': 'Verbindung fehlgeschlagen',

  // Skill-Kategorien
  'settings.skills.category.communication': 'Kommunikation',
  'settings.skills.category.productivity': 'Produktivität',
  'settings.skills.category.information': 'Information',
  'settings.skills.category.media': 'Medien',
  'settings.skills.category.other': 'Anderes',

  // Evidence Modal
  'evidence.noDetails': 'Keine Details verfügbar',
  'evidence.close': 'Schließen',

  // Debug Panel
  'debug.title': '🪲 Debug Log',
  'debug.clear': 'Löschen',
  'debug.close': '✕ Schließen',
  'debug.download': '📥 Download',
  'debug.empty': 'Noch keine Logs. Sende eine Nachricht um zu starten.',
  'debug.truncated': '… (abgeschnitten)',
  'debug.tapForMore': 'Nochmal tippen für vollständigen Inhalt',
  'debug.shareError.title': 'Teilen nicht möglich',
  'debug.shareError.message.generic': 'Der Teilen-Dialog konnte nicht geöffnet werden. Das Log ist möglicherweise zu groß oder es sind keine Teilen-Apps verfügbar.',
  'debug.shareError.message.noApps': 'Keine Apps zum Teilen verfügbar. Bitte installiere einen Dateimanager oder eine Messaging-App.',
  'debug.shareError.ok': 'OK',

  // Skill Test Evidence
  'evidence.iterations': 'Iterationen: {count}',
  'evidence.toolCalls': '━━━ Tool-Aufrufe ━━━',
  'evidence.toolResults': '━━━ Tool-Ergebnisse ━━━',
  'evidence.finalResponse': '━━━ Finale Antwort ━━━',
  'evidence.truncatedLines': '   ...',
  'evidence.success': '✓ Test erfolgreich',
  'evidence.failure': '✗ Test fehlgeschlagen',

  // TTS test results (spoken)
  'test.tts.success': 'Test erfolgreich.',
  'test.tts.failed': 'Test fehlgeschlagen.',
  'test.tts.iterations': '{count} Iterationen durchgeführt.',

  // Notification access error
  'notification.settingsError': 'Einstellungen konnten nicht geöffnet werden',

  // Service Client ID change confirmation
  'alert.serviceClientIdChanged.title': 'Dienst trennen?',
  'alert.serviceClientIdChanged.message': 'Die Änderung der {provider} Client-ID macht die bestehende Verbindung ungültig. Du musst den Dienst danach neu verbinden.',
  'alert.serviceClientIdChanged.cancel': 'Abbrechen',
  'alert.serviceClientIdChanged.confirm': 'Ändern & trennen',

  // Agent-Iterationen
  'settings.section.agent': 'Agent-Iterationen',
  'settings.agent.description': 'Legt fest, wie viele Runden das LLM maximal pro Anfrage durchlaufen darf, bevor es abbricht.',
  'settings.agent.mainLabel': 'Haupt-Agent',
  'settings.agent.mainDesc': 'Conversation Pipeline (Normal- & Fahrmodus)',
  'settings.agent.subLabel': 'Sub-Agent (Benachrichtigung & Zeitplan)',
  'settings.agent.subDesc': 'Benachrichtigungs- und Zeitplan-Sub-Agents',
  'settings.agent.accessibilityLabel': 'Accessibility Sub-Agent',
  'settings.agent.accessibilityDesc': 'UI-Automatisierung (Apps steuern)',
  'settings.agent.validationError': 'Bitte einen Wert zwischen 6 und 50 eingeben',

  // Avatar-Menü
  'menu.settings': 'Einstellungen',
  'menu.debug': 'Debug-Log',
  'menu.darkMode.dark': 'Helles Design',
  'menu.darkMode.light': 'Dunkles Design',
  'menu.lists': 'Listen',
  'menu.scheduler': 'Zeitpläne',
  'menu.notificationListeners': 'Benachrichtigungen',

  // Listen-Screen
  'lists.title': 'Listen',
  'lists.empty': 'Keine Listen vorhanden.\nErstelle eine Liste indem du Sanna z.\u00A0B. sagst: \u201EF\u00FCge Milch zur Einkaufsliste hinzu\u201C',
  'lists.item.singular': 'Eintrag',
  'lists.item.plural': 'Eintr\u00E4ge',
  'lists.editMode.button': 'Bearbeiten',
  'lists.editMode.done': 'Fertig',
  'lists.deleteList.button': 'Liste l\u00F6schen',
  'lists.items.empty': 'Liste ist leer',
  'lists.delete.title': 'Liste l\u00F6schen',
  'lists.delete.message': 'M\u00F6chtest du diese Liste wirklich l\u00F6schen?',
  'lists.delete.cancel': 'Abbrechen',
  'lists.delete.confirm': 'L\u00F6schen',

  // Scheduler-Screen
  'schedules.title': 'Zeitpläne',
  'schedules.empty': 'Keine Zeitpl\u00E4ne vorhanden.\nErstelle einen Eintrag indem du Sanna z.\u00A0B. sagst: \u201EErinnere mich morgen um 9\u00A0Uhr\u2026\u201C',
  'schedules.detail.instruction': 'Anweisung',
  'schedules.detail.triggerAt': 'Ausf\u00FChrung',
  'schedules.detail.recurrence': 'Wiederholung',
  'schedules.detail.status': 'Status',
  'schedules.detail.createdAt': 'Erstellt',
  'schedules.detail.lastExecuted': 'Zuletzt ausgef\u00FChrt',
  'schedules.status.active': '\u2705 Aktiv',
  'schedules.status.disabled': '\u23F8\uFE0F Deaktiviert',
  'schedules.deleteButton': 'Eintrag l\u00F6schen',
  'schedules.delete.title': 'Eintrag l\u00F6schen?',
  'schedules.delete.message': 'Diesen Zeitplan-Eintrag wirklich l\u00F6schen?',
  'schedules.delete.cancel': 'Abbrechen',
  'schedules.delete.confirm': 'L\u00F6schen',
  'schedules.recurrence.once': 'Einmalig',
  'schedules.recurrence.interval.minutes': 'Alle {count} Minuten',
  'schedules.recurrence.interval.hours': 'Alle {hours} Stunden',
  'schedules.recurrence.interval.hoursMinutes': 'Alle {hours}h {minutes}min',
  'schedules.recurrence.daily': 'T\u00E4glich um {time}',
  'schedules.recurrence.weekly': 'W\u00F6chentlich {days} um {time}',

  // Notification-Listener-Screen
  'notifListeners.title': 'Benachrichtigungs-Regeln',
  'notifListeners.empty': 'Keine Benachrichtigungs-Regeln vorhanden.\nErstelle eine Regel indem du Sanna z.\u00A0B. sagst: \u201ELies mir WhatsApp-Nachrichten vor\u201C',
  'notifListeners.detail.app': 'App',
  'notifListeners.detail.instruction': 'Anweisung',
  'notifListeners.detail.condition': 'Bedingung',
  'notifListeners.detail.conditionAlways': '(immer ausl\u00F6sen)',
  'notifListeners.detail.status': 'Status',
  'notifListeners.detail.createdAt': 'Erstellt',
  'notifListeners.status.active': '\u2705 Aktiv',
  'notifListeners.status.disabled': '\u23F8\uFE0F Deaktiviert',
  'notifListeners.deleteButton': 'Listener l\u00F6schen',
  'notifListeners.delete.title': 'Listener l\u00F6schen?',
  'notifListeners.delete.message': 'Diese Benachrichtigungs-Regel wirklich l\u00F6schen?',
  'notifListeners.delete.cancel': 'Abbrechen',
  'notifListeners.delete.confirm': 'L\u00F6schen',

  // Services / OAuth Client IDs
  'settings.section.services': 'Dienste & OAuth',
  'settings.services.intro': 'Konfiguriere die OAuth-Client-IDs für Google, Spotify und Slack sowie den Picovoice-Key für die Wake-Word-Erkennung.',
  'settings.services.configured': '● Konfiguriert',
  'settings.services.notConfigured': '○ Nicht konfiguriert',
  'settings.services.hideInstructions': 'Anleitung ausblenden',
  'settings.services.showInstructions': 'Wie bekomme ich diesen Key?',
  'settings.services.google.label': 'Google Web Client ID',
  'settings.services.google.instructions': 'Erstelle im Google Cloud Console → APIs & Dienste → Anmeldedaten einen OAuth-2.0-Client (Typ: Web). Kopiere die Client-ID (endet auf .apps.googleusercontent.com) und füge sie hier ein.\n\nBenötigte APIs (aktivieren unter APIs & Dienste → Bibliothek):\n• Google Calendar API\n• Google People API (für Kontakte)\n• Google Tasks API\n• Gmail API',
  'settings.services.spotify.label': 'Spotify Client ID',
  'settings.services.spotify.instructions': 'Öffne das Spotify Developer Dashboard (developer.spotify.com), erstelle eine neue App und kopiere die Client-ID von der App-Übersichtsseite.',
  'settings.services.picovoice.label': 'Picovoice Access Key',
  'settings.services.picovoice.instructions': 'Registriere dich auf console.picovoice.ai und kopiere deinen Access Key aus dem Dashboard. Wird für das Wake-Word-Feature "Hey Sanna" benötigt.',
  'settings.services.slack.label': 'Slack Client ID',
  'settings.services.slack.instructions': 'Erstelle eine Slack-App unter api.slack.com/apps, aktiviere OAuth & Permissions und kopiere die Client-ID von der Seite "Basic Information".',
  'settings.services.googleMaps.label': 'Google Maps API Key',
  'settings.services.googleMaps.instructions': 'Öffne die Google Cloud Console (console.cloud.google.com) und erstelle einen API-Schlüssel unter "APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → API-Schlüssel".\n\nAktiviere diese APIs unter "APIs & Dienste → Bibliothek":\n• Routes API (für Routen- und Verkehrsinformationen)\n• Geocoding API (für Adresssuche)\n\nOptional: Schränke den Schlüssel auf diese APIs ein.',
} as const;

export default de;

/**
 * SannaBot – Mobile AI Assistant
 * Main App entry point: wires all services together
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, LogBox, Platform, Text, TouchableOpacity, View } from 'react-native';
import { vars } from 'nativewind';


// Suppress LogBox warning banner – it overlays the input row in dev mode
LogBox.ignoreAllLogs(true);
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

// i18n
import { t, setLocale } from './src/i18n';

// Services
import { SkillLoader } from './src/agent/skill-loader';
import { DynamicSkillStore } from './src/agent/dynamic-skill-store';
import { validateSkillContent, extractSkillName } from './src/agent/skill-validator';
import { ToolRegistry } from './src/agent/tool-registry';
import { ConversationPipeline } from './src/agent/conversation-pipeline';
import type { PipelineState } from './src/agent/conversation-pipeline';
import { runSkillTest } from './src/agent/skill-test';
import { ClaudeProvider } from './src/llm/claude-provider';
import { OpenAIProvider } from './src/llm/openai-provider';
import { TTSService } from './src/audio/tts-service';
import { STTService } from './src/audio/stt-service';
import { WakeWordService } from './src/audio/wake-word-service';
import { TokenStore } from './src/permissions/token-store';
import { CredentialManager } from './src/permissions/credential-manager';
import { PermissionManager } from './src/permissions/permission-manager';
import { SpotifyAuth } from './src/permissions/spotify-auth';
import { GoogleAuth } from './src/permissions/google-auth';
import { SlackAuth } from './src/permissions/slack-auth';
import {
  getNotificationListenerModule,
  createNotificationEventEmitter,
  type NotificationData,
} from './src/native/NotificationListenerModule';

// Tools
import { IntentTool } from './src/tools/intent-tool';
import { TTSTool } from './src/tools/tts-tool';
import { HttpTool } from './src/tools/http-tool';
import { QueryTool } from './src/tools/query-tool';
import { DeviceTool } from './src/tools/device-tool';
import { SmsTool } from './src/tools/sms-tool';
import { SchedulerTool } from './src/tools/scheduler-tool';
import { NotificationListenerTool } from './src/tools/notification-listener-tool';
import { AccessibilityTool } from './src/tools/accessibility-tool';
import { FileStorageTool } from './src/tools/file-storage-tool';

// Scheduler config persistence
import SchedulerModule from './src/native/SchedulerModule';

// Conversation persistence
import { ConversationStore } from './src/agent/conversation-store';

// AsyncStorage for lightweight pre-unlock preferences (dark mode)
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import type { SkillInfo } from './src/agent/skill-loader';
import { SannaAvatar } from './src/components/SannaAvatar';

// Local dev config (gitignored – never shipped to production)
// Falls die Datei fehlt (z.B. in CI/Production), werden leere Defaults verwendet.
let LOCAL_CONFIG: { openAIApiKey: string; claudeApiKey: string; selectedProvider: 'claude' | 'openai'; openAIModel?: string; claudeModel?: string; spotifyClientId: string; googleWebClientId: string; picovoiceAccessKey: string; slackClientId: string; slackRedirectUrl: string } = {
  openAIApiKey: '',
  claudeApiKey: '',
  selectedProvider: 'openai',
  openAIModel: '',
  claudeModel: '',
  spotifyClientId: '',
  googleWebClientId: '',
  picovoiceAccessKey: '',
  slackClientId: '',
  slackRedirectUrl: '',
};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LOCAL_CONFIG = require('./local.config').default;
} catch {
  // No local.config.ts present – use empty defaults (production / CI)
}

// Auto-register all SKILL.md files found under assets/skills/*/SKILL.md.
// Adding a new skill folder is all that's needed – no changes here required.
import './src/agent/skill-auto-register';

// ─── Themes ───────────────────────────────────────────────────────────────────
// CSS variable bundles applied to the root view via NativeWind vars().
// All semantic color tokens (surface, label) in tailwind.config.js reference
// these variables, so the entire UI flips by swapping this one style object.

const DARK_THEME = vars({
  '--color-surface': '#1C1C1E',
  '--color-surface-elevated': '#2C2C2E',
  '--color-surface-tertiary': '#3A3A3C',
  '--color-label-primary': '#FFFFFF',
  '--color-label-secondary': '#8E8E93',
  '--color-label-tertiary': '#636366',
  '--color-label-quaternary': 'rgba(255,255,255,0.45)',
});

const LIGHT_THEME = vars({
  '--color-surface': '#F2F2F7',
  '--color-surface-elevated': '#FFFFFF',
  '--color-surface-tertiary': '#E5E5EA',
  '--color-label-primary': '#000000',
  '--color-label-secondary': '#6C6C70',
  '--color-label-tertiary': '#8E8E93',
  '--color-label-quaternary': 'rgba(0,0,0,0.45)',
});

// ─── Settings ─────────────────────────────────────────────────────────────────
// ALL settings are stored in Keychain via TokenStore.
// This ensures they survive app reinstallation (unlike AsyncStorage).
// - Preferences (provider, skills, STT, etc.) → single JSON blob in Keychain
// - Secure keys (API keys, wake-word key, models) → individual Keychain entries


/** Resolve system locale to BCP-47 format (e.g. 'de-AT', 'en-US') */
function getSystemLocale(): string {
  if (Platform.OS === 'android') {
    // Android: use Intl API if available, fallback to 'de-AT'
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      // Convert underscore to dash (e.g. 'de_AT' -> 'de-AT')
      return locale.replace('_', '-');
    } catch {
      return 'de-AT';
    }
  }
  // iOS fallback
  return 'de-AT';
}

/** App preferences (stored as JSON blob in Keychain) */
interface AppPreferences {
  selectedProvider: 'claude' | 'openai';
  wakeWordEnabled: boolean;
  enabledSkillNames: string[];
  drivingMode: boolean;
  darkMode: boolean;
  sttLanguage: 'system' | string;
  sttMode: 'auto' | 'offline' | 'online';
  /** App UI language. 'system' = detect from device locale. Falls back to 'en'. */
  appLanguage: 'system' | string;
}

/** Full app settings (preferences + secure keys loaded from Keychain) */
interface AppSettings extends AppPreferences {
  claudeApiKey: string;
  openAIApiKey: string;
  wakeWordKey: string;
  selectedOpenAIModel: string;
  selectedClaudeModel: string;
  googleWebClientId: string;
  spotifyClientId: string;
  slackClientId: string;
}

const DEFAULT_PREFS: AppPreferences = {
  selectedProvider: LOCAL_CONFIG.selectedProvider,
  wakeWordEnabled: !!LOCAL_CONFIG.picovoiceAccessKey,
  enabledSkillNames: ['google-maps', 'phone', 'sms'],
  drivingMode: false,
  darkMode: true,
  sttLanguage: 'system',
  sttMode: 'auto',
  appLanguage: 'system',
};

const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_PREFS,
  claudeApiKey: '',
  openAIApiKey: '',
  wakeWordKey: '',
  selectedOpenAIModel: LOCAL_CONFIG.openAIModel || 'gpt-5.2',
  selectedClaudeModel: LOCAL_CONFIG.claudeModel || 'claude-sonnet-4-6',
  googleWebClientId: '',
  spotifyClientId: '',
  slackClientId: '',
};

// Keychain IDs for secure key storage
const SECURE_KEY_IDS = {
  claudeApiKey: 'llm_claude',
  openAIApiKey: 'llm_openai',
  wakeWordKey: 'wakeword_picovoice',
  openAIModel: 'llm_openai_model',
  claudeModel: 'llm_claude_model',
  preferences: 'app_preferences',
  googleWebClientId: 'svc_google_web_client_id',
  spotifyClientId: 'svc_spotify_client_id',
  slackClientId: 'svc_slack_client_id',
} as const;

/** AsyncStorage key for dark-mode preference – readable without biometric unlock */
const DARK_MODE_STORAGE_KEY = 'sanna_dark_mode';

/** Load preferences from Keychain */
async function loadPreferences(store: TokenStore): Promise<AppPreferences> {
  try {
    const json = await store.getApiKey(SECURE_KEY_IDS.preferences);
    if (json) {
      const saved = JSON.parse(json) as Partial<AppPreferences>;
      return { ...DEFAULT_PREFS, ...saved };
    }
  } catch {
    // Corrupt or missing – fall through to defaults
  }
  return DEFAULT_PREFS;
}

/** Persist preferences to Keychain (survives app reinstallation) */
async function savePreferences(store: TokenStore, s: AppPreferences): Promise<void> {
  try {
    const toSave: AppPreferences = {
      selectedProvider: s.selectedProvider,
      wakeWordEnabled: s.wakeWordEnabled,
      enabledSkillNames: s.enabledSkillNames,
      drivingMode: s.drivingMode,
      darkMode: s.darkMode,
      sttLanguage: s.sttLanguage,
      sttMode: s.sttMode,
      appLanguage: s.appLanguage,
    };
    await store.saveApiKey(SECURE_KEY_IDS.preferences, JSON.stringify(toSave));
  } catch {
    // Non-critical
  }
}

/** Load secure keys from Keychain (requires unlocked TokenStore) */
async function loadSecureKeys(store: TokenStore): Promise<{
  claudeApiKey: string;
  openAIApiKey: string;
  wakeWordKey: string;
  selectedOpenAIModel: string;
  selectedClaudeModel: string;
  googleWebClientId: string;
  spotifyClientId: string;
  slackClientId: string;
}> {
  const [claude, openai, wakeWord, openAIModel, claudeModel, googleWebClientId, spotifyClientId, slackClientId] = await Promise.all([
    store.getApiKey(SECURE_KEY_IDS.claudeApiKey).catch(() => null),
    store.getApiKey(SECURE_KEY_IDS.openAIApiKey).catch(() => null),
    store.getApiKey(SECURE_KEY_IDS.wakeWordKey).catch(() => null),
    store.getApiKey(SECURE_KEY_IDS.openAIModel).catch(() => null),
    store.getApiKey(SECURE_KEY_IDS.claudeModel).catch(() => null),
    store.getApiKey(SECURE_KEY_IDS.googleWebClientId).catch(() => null),
    store.getApiKey(SECURE_KEY_IDS.spotifyClientId).catch(() => null),
    store.getApiKey(SECURE_KEY_IDS.slackClientId).catch(() => null),
  ]);
  return {
    claudeApiKey: claude ?? '',
    openAIApiKey: openai ?? '',
    wakeWordKey: wakeWord ?? '',
    selectedOpenAIModel: openAIModel || LOCAL_CONFIG.openAIModel || 'gpt-4o',
    selectedClaudeModel: claudeModel || LOCAL_CONFIG.claudeModel || 'claude-3-5-sonnet-20241022',
    googleWebClientId: googleWebClientId ?? '',
    spotifyClientId: spotifyClientId ?? '',
    slackClientId: slackClientId ?? '',
  };
}

/** Save a secure key to Keychain */
async function saveSecureKey(
  store: TokenStore,
  keyId: string,
  value: string,
): Promise<void> {
  if (value) {
    await store.saveApiKey(keyId, value);
  } else {
    await store.deleteApiKey(keyId);
  }
}


/**
 * Seed keys from local.config.ts into Keychain on first run.
 * Only writes if the key slot is currently empty.
 */
async function seedLocalConfigKeys(store: TokenStore): Promise<void> {
  if (LOCAL_CONFIG.claudeApiKey) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.claudeApiKey).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.claudeApiKey, LOCAL_CONFIG.claudeApiKey);
    }
  }
  if (LOCAL_CONFIG.openAIApiKey) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.openAIApiKey).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.openAIApiKey, LOCAL_CONFIG.openAIApiKey);
    }
  }
  if (LOCAL_CONFIG.picovoiceAccessKey) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.wakeWordKey).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.wakeWordKey, LOCAL_CONFIG.picovoiceAccessKey);
    }
  }
  if (LOCAL_CONFIG.openAIModel) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.openAIModel).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.openAIModel, LOCAL_CONFIG.openAIModel);
    }
  }
  if (LOCAL_CONFIG.claudeModel) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.claudeModel).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.claudeModel, LOCAL_CONFIG.claudeModel);
    }
  }
  if (LOCAL_CONFIG.googleWebClientId) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.googleWebClientId).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.googleWebClientId, LOCAL_CONFIG.googleWebClientId);
    }
  }
  if (LOCAL_CONFIG.spotifyClientId) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.spotifyClientId).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.spotifyClientId, LOCAL_CONFIG.spotifyClientId);
    }
  }
  if (LOCAL_CONFIG.slackClientId) {
    const existing = await store.getApiKey(SECURE_KEY_IDS.slackClientId).catch(() => null);
    if (!existing) {
      await store.saveApiKey(SECURE_KEY_IDS.slackClientId, LOCAL_CONFIG.slackClientId);
    }
  }
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// ─── Lock Screen ──────────────────────────────────────────────────────────────

function LockScreen({
  onUnlock,
  error,
}: {
  onUnlock: () => void;
  error?: string;
}): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-8">
        <View style={{ marginBottom: 16 }}>
          <SannaAvatar size={96} />
        </View>
        <Text className="text-label-primary text-xl font-bold mb-2">
          {t('app.locked.title')}
        </Text>
        <Text className="text-label-secondary text-sm text-center mb-8">
          {t('app.locked.subtitle')}
        </Text>

        {error ? (
          <Text className="text-red-500 text-sm text-center mb-4">{error}</Text>
        ) : null}

        <TouchableOpacity
          className="bg-accent px-8 py-4 rounded-2xl"
          onPress={onUnlock}
          activeOpacity={0.7}>
          <Text className="text-white text-base font-semibold">{t('app.locked.button')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App(): React.JSX.Element {
  // Vault state
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultError, setVaultError] = useState<string | undefined>();
  const [initializing, setInitializing] = useState(true);

  const [screen, setScreen] = useState<'home' | 'settings'>('home');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Services (initialized lazily)
  const ttsService = useRef(new TTSService());
  const sttService = useRef(new STTService());
  const wakeWordService = useRef(new WakeWordService());
  const tokenStore = useRef(new TokenStore());
  const credentialManager = useRef(new CredentialManager(tokenStore.current));
  const permissionManager = useRef(new PermissionManager());
  const spotifyAuth = useRef(new SpotifyAuth(credentialManager.current));
  const googleAuth = useRef(new GoogleAuth(credentialManager.current));
  const slackAuth = useRef(new SlackAuth(credentialManager.current));
  const pipelineRef = useRef<ConversationPipeline | null>(null);

  const skillLoader = useRef(new SkillLoader());
  const dynamicSkillStore = useRef(new DynamicSkillStore());
  const [allSkills, setAllSkills] = useState(() => skillLoader.current.getAllSkills());
  const [dynamicSkillNames, setDynamicSkillNames] = useState<string[]>([]);
  const [skillAvailability, setSkillAvailability] = useState<Record<string, boolean>>({});

  // ─── i18n: apply locale whenever appLanguage changes ────────────────────
  useEffect(() => {
    setLocale(settings.appLanguage);
  }, [settings.appLanguage]);

  // ─── Biometric unlock ───────────────────────────────────────────────────

  const attemptUnlock = useCallback(async () => {
    setVaultError(undefined);
    const store = tokenStore.current;

    const success = await store.authenticate('Sanna entsperren');
    if (!success) {
      setVaultError(t('app.locked.authError'));
      setInitializing(false);
      return;
    }

    setVaultUnlocked(true);

    // Seed keys from local.config.ts (dev only, first run)
    await seedLocalConfigKeys(store);

    // Load preferences + secure keys in parallel (both from Keychain)
    const [prefs, secureKeys] = await Promise.all([
      loadPreferences(store),
      loadSecureKeys(store),
    ]);

    // Apply locale from loaded preferences immediately
    setLocale(prefs.appLanguage);

    setSettings({ ...prefs, ...secureKeys });
    setSettingsLoaded(true);
    setInitializing(false);

    // Mirror dark mode to AsyncStorage so it's available before the next unlock
    AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, prefs.darkMode ? 'true' : 'false').catch(() => {});

    // Load user-uploaded dynamic skills from AsyncStorage
    await skillLoader.current.loadDynamicSkills(dynamicSkillStore.current);
    const dynamicNames = await dynamicSkillStore.current.getSkillNames();
    setDynamicSkillNames(dynamicNames);
    setAllSkills(skillLoader.current.getAllSkills());

    // Restore persisted conversation history into the UI
    const storedMessages = await ConversationStore.loadHistory();
    if (storedMessages.length > 0) {
      setMessages(
        storedMessages.map(m => ({ role: m.role, text: m.text, timestamp: new Date(m.timestamp) })),
      );
    }
  }, []);

  // Load dark mode from AsyncStorage immediately (before biometric unlock)
  // so the lock screen already uses the correct theme.
  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_STORAGE_KEY).then(value => {
      if (value !== null) {
        setSettings(s => ({ ...s, darkMode: value === 'true' }));
      }
    }).catch(() => {});
  }, []);

  // Auto-unlock on mount
  useEffect(() => {
    attemptUnlock();
  }, [attemptUnlock]);

  // Lock when app goes to background for more than LOCK_GRACE_MS.
  // Short background trips (e.g. OAuth browser redirect, permission dialogs)
  // should NOT re-lock the vault.
  // In driving mode, never auto-lock – the user expects hands-free operation.
  const backgroundAtRef = useRef<number | null>(null);
  const LOCK_GRACE_MS = 2 * 60 * 1000; // 2 minutes

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        backgroundAtRef.current = Date.now();
      } else if (nextState === 'active' && backgroundAtRef.current !== null) {
        const elapsed = Date.now() - backgroundAtRef.current;
        backgroundAtRef.current = null;
        if (elapsed > LOCK_GRACE_MS && !settings.drivingMode) {
          tokenStore.current.lock();
          setVaultUnlocked(false);
        }

        // Drain any messages written by background tasks (e.g. accessibility automation)
        ConversationStore.drainPending().then(pending => {
          if (pending.length === 0) return;
          setMessages(prev => {
            const updated = [
              ...prev,
              ...pending.map(m => ({ role: m.role, text: m.text, timestamp: new Date(m.timestamp) })),
            ];
            ConversationStore.saveHistory(
              updated.map(m => ({ role: m.role, text: m.text, timestamp: m.timestamp.toISOString() })),
            ).catch(() => {});
            return updated;
          });
          if (pipelineRef.current) {
            pipelineRef.current.appendToHistory(
              pending.map(m => ({ role: m.role, content: m.text })),
            );
          }
          // In driving mode, speak assistant messages aloud.
          // In normal mode the chat bubble is sufficient – no TTS.
          if (settings.drivingMode) {
            const lang = settings.appLanguage === 'system' ? getSystemLocale() : settings.appLanguage;
            pending
              .filter(m => m.role === 'assistant')
              .forEach(m => {
                // Strip markdown so the voice output sounds natural
                const plain = m.text.replace(/[*_`#]/g, '').trim();
                ttsService.current.speak(plain, lang).catch(() => {});
              });
          }
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [settings.drivingMode]);

  // Persist preferences to Keychain whenever they change
  useEffect(() => {
    if (settingsLoaded && vaultUnlocked) {
      savePreferences(tokenStore.current, settings);
    }
  }, [
    settings.selectedProvider,
    settings.wakeWordEnabled,
    settings.enabledSkillNames,
    settings.drivingMode,
    settings.darkMode,
    settings.sttLanguage,
    settings.sttMode,
    settings.appLanguage,
    settingsLoaded,
    vaultUnlocked,
  ]);

  // Initialize services (audio only – auth services are configured reactively below)
  useEffect(() => {
    ttsService.current.init();
    sttService.current.init();

    // Register setup handlers once (they are no-ops until the service is configured)
    spotifyAuth.current.registerSetupHandler();
    googleAuth.current.registerSetupHandler();
    slackAuth.current.registerSetupHandler();

    // Check which required Android apps are installed (static, once on mount)
    skillLoader.current.checkAppAvailability().then(availability => {
      setSkillAvailability(availability);

      const unavailable = new Set(
        Object.entries(availability)
          .filter(([, installed]) => !installed)
          .map(([name]) => name),
      );
      if (unavailable.size > 0) {
        setSettings(prev => ({
          ...prev,
          enabledSkillNames: prev.enabledSkillNames.filter(n => !unavailable.has(n)),
        }));
      }
    });

    return () => {
      ttsService.current.destroy();
      sttService.current.destroy();
    };
  }, []);

  // Re-configure OAuth services whenever the stored client IDs change.
  // This runs after settings are loaded from Keychain and whenever the user
  // updates a client ID in the Services settings section.
  useEffect(() => {
    if (!settingsLoaded) return;

    const { spotifyClientId: sClientId, googleWebClientId: gClientId, slackClientId: slClientId } = settings;

    if (sClientId) {
      spotifyAuth.current.configure(sClientId);
    }
    if (gClientId) {
      googleAuth.current.configure(gClientId);
    }
    if (slClientId) {
      slackAuth.current.configure(slClientId);
    }

    // Re-evaluate skill availability based on whether client IDs are configured
    setSkillAvailability(prev => ({
      ...prev,
      spotify: sClientId ? (prev['spotify'] ?? true) : false,
      slack: slClientId ? (prev['slack'] ?? true) : false,
    }));
  }, [settingsLoaded, settings.spotifyClientId, settings.googleWebClientId, settings.slackClientId]);

  // Rebuild pipeline when settings change (only after unlock)
  useEffect(() => {
    if (!vaultUnlocked || !settingsLoaded) return;

    const { claudeApiKey, openAIApiKey, selectedProvider, enabledSkillNames } = settings;
    const apiKey = selectedProvider === 'claude' ? claudeApiKey : openAIApiKey;

    if (!apiKey) return;

    const selectedModel = selectedProvider === 'claude'
      ? settings.selectedClaudeModel
      : settings.selectedOpenAIModel;

    const provider =
      selectedProvider === 'claude'
        ? new ClaudeProvider(apiKey, selectedModel)
        : new OpenAIProvider(apiKey, selectedModel);

    const toolRegistry = new ToolRegistry();
    toolRegistry.register(new IntentTool());
    // TTSTool is NOT registered in the interactive pipeline –
    // TTS is handled directly by the pipeline (driving mode) or not at all (normal mode).
    toolRegistry.register(new HttpTool(credentialManager.current));
    toolRegistry.register(new QueryTool());
    toolRegistry.register(new DeviceTool());
    toolRegistry.register(new SmsTool());
    toolRegistry.register(new SchedulerTool());
    toolRegistry.register(new NotificationListenerTool());
    toolRegistry.register(new AccessibilityTool());
    toolRegistry.register(new FileStorageTool());

    // Resolve 'system' → actual device locale before passing to pipeline.
    // The pipeline uses this for both TTS and the system-prompt language rule.
    const resolvedLanguage =
      settings.appLanguage === 'system' ? getSystemLocale() : settings.appLanguage;

    const pipeline = new ConversationPipeline({
      provider,
      model: provider.getDefaultModel(),
      tools: toolRegistry,
      skillLoader: skillLoader.current,
      ttsService: ttsService.current,
      drivingMode: settings.drivingMode,
      maxIterations: 10,
      maxHistoryMessages: 20,
      language: resolvedLanguage,
    });

    pipeline.setEnabledSkills(enabledSkillNames);
    pipeline.setCallbacks({
      onStateChange: setPipelineState,
      onError: (err: string) => {
        Alert.alert(t('alert.error'), err);
      },
      onTranscript: (role: 'user' | 'assistant', text: string) => {
        setMessages(prev => {
          const updated = [...prev, { role, text, timestamp: new Date() }];
          // Fire-and-forget: persist conversation after each message
          ConversationStore.saveHistory(
            updated.map(m => ({ role: m.role, text: m.text, timestamp: m.timestamp.toISOString() })),
          ).catch(() => {});
          return updated;
        });
      },
    });

    // Preserve conversation history across pipeline recreations
    const oldPipeline = pipelineRef.current;
    if (oldPipeline) {
      pipeline.importHistory(oldPipeline.exportHistory());
    } else {
      // First pipeline creation: restore LLM history from AsyncStorage.
      // Only the last 20 messages are injected (maxHistoryMessages cap).
      ConversationStore.loadHistory().then(stored => {
        if (stored.length > 0) {
          pipeline.importHistory(
            stored.slice(-20).map(m => ({ role: m.role, content: m.text })),
          );
        }
      }).catch(() => {});
    }

    pipelineRef.current = pipeline;

    // Persist agent config so the headless scheduler sub-agent can use it
    const agentConfig = {
      apiKey: apiKey,
      provider: selectedProvider,
      model: selectedModel,
      enabledSkillNames,
      googleWebClientId: settings.googleWebClientId || '',
      drivingMode: settings.drivingMode,
      language: resolvedLanguage,
    };
    SchedulerModule.saveAgentConfig(JSON.stringify(agentConfig)).catch(() => {});
  }, [
    vaultUnlocked,
    settingsLoaded,
    settings.claudeApiKey,
    settings.openAIApiKey,
    settings.selectedProvider,
    settings.selectedOpenAIModel,
    settings.selectedClaudeModel,
    settings.enabledSkillNames,
    settings.drivingMode,
    settings.appLanguage,
    settings.googleWebClientId,
  ]);

  // Wake word management
  useEffect(() => {
    if (!vaultUnlocked) return;
    const { wakeWordEnabled, wakeWordKey } = settings;

    if (wakeWordEnabled && wakeWordKey) {
      permissionManager.current
        .isGranted('android.permission.RECORD_AUDIO')
        .then(granted => {
          if (granted) {
            wakeWordService.current.start(handleWakeWordDetected, wakeWordKey);
          }
        });
    } else {
      wakeWordService.current.stop();
    }

    return () => {
      wakeWordService.current.stop();
    };
  }, [vaultUnlocked, settings.wakeWordEnabled, settings.wakeWordKey]);

  // Notification listener management
  useEffect(() => {
    if (!vaultUnlocked || !settingsLoaded) return;
    if (!settings.enabledSkillNames.includes('notifications')) return;

    const module = getNotificationListenerModule();
    if (!module) return;

    // Check if notification access is granted
    module.isNotificationAccessGranted().then(granted => {
      if (!granted) {
        // Access not granted - user needs to enable it in settings
        return;
      }

      // Set up event listener for incoming notifications
      const eventEmitter = createNotificationEventEmitter();
      if (!eventEmitter) return;

      const subscription = eventEmitter.addListener('onNotification', (notification: NotificationData) => {
        handleNotificationReceived(notification);
      });

      return () => {
        subscription.remove();
      };
    });
  }, [vaultUnlocked, settingsLoaded, settings.enabledSkillNames]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleWakeWordDetected = useCallback(async (_keyword: string) => {
    if (pipelineState !== 'idle' || !pipelineRef.current) return;
    await ttsService.current.speak('Yes?', settings.appLanguage === 'system' ? getSystemLocale() : settings.appLanguage);
    handleMicPress();
  }, [pipelineState]);

  const handleMicPress = useCallback(async () => {
    if (!pipelineRef.current) {
      Alert.alert(t('alert.noApiKey.title'), t('alert.noApiKey.message'));
      return;
    }
    // If TTS is currently speaking, stop it immediately and start listening
    if (pipelineState === 'speaking') {
      await pipelineRef.current.stopSpeaking();
    } else if (pipelineState !== 'idle') {
      return;
    }

    const permResult = await permissionManager.current.ensurePermissions([
      'android.permission.RECORD_AUDIO',
    ]);
    if (!permResult.allGranted) {
      Alert.alert(t('alert.micPermission.title'), t('alert.micPermission.message'));
      return;
    }

    try {
      setPipelineState('listening');
      // Resolve language: 'system' -> device locale, otherwise use setting
      const language = settings.sttLanguage === 'system' 
        ? getSystemLocale() 
        : settings.sttLanguage;
      const transcript = await sttService.current.listen(language, settings.sttMode);
      if (!transcript?.trim()) {
        setPipelineState('idle');
        return;
      }
      await pipelineRef.current.processUtterance(transcript);
    } catch (err) {
      setPipelineState('idle');
      if (err instanceof Error && !err.message.includes('cancel')) {
        Alert.alert(t('alert.sttError'), err.message);
      }
    }
  }, [pipelineState, settings.sttLanguage, settings.sttMode]);

  const handleTextSubmit = useCallback(async (text: string) => {
    if (!pipelineRef.current) {
      Alert.alert(t('alert.noApiKey.title'), t('alert.noApiKey.message'));
      return;
    }
    if (pipelineState !== 'idle') return;

    try {
      await pipelineRef.current.processUtterance(text);
    } catch (err) {
      setPipelineState('idle');
      if (err instanceof Error) {
        Alert.alert(t('alert.error'), err.message);
      }
    }
  }, [pipelineState]);

  const handleToggleDrivingMode = useCallback(() => {
    setSettings(s => ({ ...s, drivingMode: !s.drivingMode }));
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    setSettings(s => {
      const next = !s.darkMode;
      // Persist immediately to AsyncStorage so it survives reinstall and loads
      // before the next biometric unlock (lock screen already uses the right theme).
      AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, next ? 'true' : 'false').catch(() => {});
      return { ...s, darkMode: next };
    });
  }, []);

  const handleNotificationReceived = useCallback(
    async (notification: NotificationData) => {
      // Only process if pipeline is idle
      if (pipelineState !== 'idle' || !pipelineRef.current) {
        return;
      }

      // Map package name to app display name
      const appAliases: Record<string, string> = {
        'com.whatsapp': 'WhatsApp',
        'com.google.android.gm': 'Email',
        'org.telegram.messenger': 'Telegram',
        'org.thoughtcrime.securesms': 'Signal',
        'com.android.mms': 'SMS',
      };
      const appName = appAliases[notification.packageName] || notification.packageName;

      // Build notification message
      const sender = notification.sender ? ` from ${notification.sender}` : '';
      const content = notification.text || notification.title || '';
      const notificationText = `New ${appName} notification${sender}: ${content}`;

      // Summarize and speak via pipeline
      try {
        await pipelineRef.current.processUtterance(
          `Summarize and read aloud: ${notificationText}`,
        );
      } catch (err) {
        // If pipeline fails, fall back to direct TTS
        if (settings.drivingMode) {
          const lang = settings.appLanguage === 'system' ? getSystemLocale() : settings.appLanguage;
          ttsService.current.speakAsync(notificationText, lang);
        }
      }
    },
    [pipelineState, settings.drivingMode, settings.appLanguage],
  );

  /** Save a secure key to Keychain AND update local state */
  const updateSecureKey = useCallback(
    async (field: 'claudeApiKey' | 'openAIApiKey' | 'wakeWordKey' | 'selectedOpenAIModel' | 'selectedClaudeModel' | 'googleWebClientId' | 'spotifyClientId' | 'slackClientId', value: string) => {
      setSettings(s => ({ ...s, [field]: value }));
      const keychainId = field === 'selectedOpenAIModel' ? SECURE_KEY_IDS.openAIModel
        : field === 'selectedClaudeModel' ? SECURE_KEY_IDS.claudeModel
        : SECURE_KEY_IDS[field];
      await saveSecureKey(tokenStore.current, keychainId, value);
    },
    [],
  );

  /**
   * Change a service Client ID.
   * If the ID actually changed and an OAuth token already exists for that
   * provider, the user is warned and – on confirmation – the token is revoked
   * before the new ID is saved. This prevents stale tokens (issued for the
   * old Client ID) from being used with the new one.
   */
  const changeServiceClientId = useCallback(
    (
      field: 'googleWebClientId' | 'spotifyClientId' | 'slackClientId',
      oauthProvider: 'google' | 'spotify' | 'slack',
      newId: string,
    ) => {
      const currentId = settings[field];

      // Nothing changed – just update without any confirmation
      if (newId === currentId) {
        updateSecureKey(field, newId);
        return;
      }

      // New value is empty (user cleared the field) – revoke token silently
      if (!newId.trim()) {
        credentialManager.current.revokeCredential(oauthProvider).catch(() => {});
        updateSecureKey(field, newId);
        return;
      }

      // ID changed and old ID was set → ask for confirmation if a token exists
      if (currentId.trim()) {
        credentialManager.current.isConfigured(oauthProvider).then(hasToken => {
          if (hasToken) {
            Alert.alert(
              t('alert.serviceClientIdChanged.title'),
              t('alert.serviceClientIdChanged.message').replace('{provider}', oauthProvider),
              [
                { text: t('alert.serviceClientIdChanged.cancel'), style: 'cancel' },
                {
                  text: t('alert.serviceClientIdChanged.confirm'),
                  style: 'destructive',
                  onPress: () => {
                    credentialManager.current.revokeCredential(oauthProvider).catch(() => {});
                    updateSecureKey(field, newId);
                  },
                },
              ],
            );
          } else {
            // No token stored – just save the new ID without prompting
            updateSecureKey(field, newId);
          }
        });
      } else {
        // Old ID was empty – no token could exist, just save
        updateSecureKey(field, newId);
      }
    },
    [settings, updateSecureKey],
  );

  const handleToggleSkill = useCallback(
    async (skillName: string, enabled: boolean) => {
      if (enabled) {
        const skill = skillLoader.current.getSkill(skillName);
        if (skill && skill.permissions.length > 0) {
          const permResult = await permissionManager.current.ensurePermissions(skill.permissions);
          if (!permResult.allGranted) {
            Alert.alert(
              t('alert.permissionMissing.title'),
              t('alert.permissionMissing.message')
                .replace('{skillName}', skillName)
                .replace('{permissions}', permResult.missing.join('\n')),
            );
            return;
          }
        }
      }
      setSettings(s => ({
        ...s,
        enabledSkillNames: enabled
          ? [...s.enabledSkillNames, skillName]
          : s.enabledSkillNames.filter(n => n !== skillName),
      }));
    },
    [],
  );

  const handleAddSkill = useCallback(
    async (content: string): Promise<{ success: boolean; error?: string }> => {
      // Validate
      const validation = validateSkillContent(content);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const skillName = extractSkillName(content);

      // Check for duplicate dynamic skills
      const alreadyDynamic = await dynamicSkillStore.current.hasSkill(skillName);
      if (alreadyDynamic) {
        return {
          success: false,
          error: `A custom skill named "${skillName}" already exists. Delete it first or use a different name.`,
        };
      }

      // Persist + register
      await dynamicSkillStore.current.saveSkill(skillName, content);
      skillLoader.current.registerDynamicSkill(skillName, content);

      // Update UI
      const newDynamicNames = await dynamicSkillStore.current.getSkillNames();
      setDynamicSkillNames(newDynamicNames);
      setAllSkills(skillLoader.current.getAllSkills());

      return { success: true };
    },
    [],
  );

  const handleDeleteSkill = useCallback(
    async (skillName: string): Promise<void> => {
      await dynamicSkillStore.current.deleteSkill(skillName);
      skillLoader.current.unregisterSkill(skillName);

      // Also disable the skill if it was enabled
      setSettings(s => ({
        ...s,
        enabledSkillNames: s.enabledSkillNames.filter(n => n !== skillName),
      }));

      const newDynamicNames = await dynamicSkillStore.current.getSkillNames();
      setDynamicSkillNames(newDynamicNames);
      setAllSkills(skillLoader.current.getAllSkills());
    },
    [],
  );

  const handleTestSkill = useCallback(
    async (skillName: string) => {
      const { claudeApiKey, openAIApiKey, selectedProvider } = settings;
      const apiKey = selectedProvider === 'claude' ? claudeApiKey : openAIApiKey;

      if (!apiKey) {
        return {
          success: false,
          message: t('alert.noApiKey.title'),
          error: t('alert.noApiKey.message'),
        };
      }

      const skill = skillLoader.current.getSkill(skillName);
      if (!skill) {
        return {
          success: false,
          message: 'Skill not found',
          error: `Skill "${skillName}" does not exist.`,
        };
      }

      const selectedModel = selectedProvider === 'claude'
        ? settings.selectedClaudeModel
        : settings.selectedOpenAIModel;

      const provider =
        selectedProvider === 'claude'
          ? new ClaudeProvider(apiKey, selectedModel)
          : new OpenAIProvider(apiKey, selectedModel);

      const toolRegistry = new ToolRegistry();
      toolRegistry.register(new IntentTool());
      toolRegistry.register(new TTSTool());
      toolRegistry.register(new HttpTool(credentialManager.current));
      toolRegistry.register(new QueryTool());
      toolRegistry.register(new DeviceTool());

      return await runSkillTest(
        skill,
        skillLoader.current,
        provider,
        toolRegistry,
        provider.getDefaultModel(),
      );
    },
    [settings],
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  const isDark = settings.darkMode !== false; // default true until prefs loaded
  const themeVars = isDark ? DARK_THEME : LIGHT_THEME;

  // Show loading spinner while initializing vault
  if (initializing) {
    return (
      <View style={[{ flex: 1 }, DARK_THEME]}>
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-surface items-center justify-center">
            <SannaAvatar size={96} />
            <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 24 }} />
            <Text className="text-label-secondary text-sm mt-4">{t('app.loading')}</Text>
          </SafeAreaView>
        </SafeAreaProvider>
      </View>
    );
  }

  // Show lock screen if vault is not unlocked
  if (!vaultUnlocked) {
    return (
      <View style={[{ flex: 1 }, DARK_THEME]}>
        <LockScreen onUnlock={attemptUnlock} error={vaultError} />
      </View>
    );
  }

  if (screen === 'settings') {
    return (
      <View style={[{ flex: 1 }, themeVars]}>
        <SafeAreaProvider>
          <SettingsScreen
            onBack={() => setScreen('home')}
            credentialManager={credentialManager.current}
            allSkills={allSkills}
            enabledSkillNames={settings.enabledSkillNames}
            skillAvailability={skillAvailability}
            onToggleSkill={handleToggleSkill}
            claudeApiKey={settings.claudeApiKey}
            onClaudeApiKeyChange={key => updateSecureKey('claudeApiKey', key)}
            openAIApiKey={settings.openAIApiKey}
            onOpenAIApiKeyChange={key => updateSecureKey('openAIApiKey', key)}
            selectedProvider={settings.selectedProvider}
            onProviderChange={p => setSettings(s => ({ ...s, selectedProvider: p }))}
            selectedOpenAIModel={settings.selectedOpenAIModel}
            onOpenAIModelChange={model => updateSecureKey('selectedOpenAIModel', model)}
            selectedClaudeModel={settings.selectedClaudeModel}
            onClaudeModelChange={model => updateSecureKey('selectedClaudeModel', model)}
            wakeWordEnabled={settings.wakeWordEnabled}
            onWakeWordToggle={v => setSettings(s => ({ ...s, wakeWordEnabled: v }))}
            wakeWordKey={settings.wakeWordKey}
            onWakeWordKeyChange={k => updateSecureKey('wakeWordKey', k)}
            sttLanguage={settings.sttLanguage}
            onSttLanguageChange={lang => setSettings(s => ({ ...s, sttLanguage: lang }))}
            sttMode={settings.sttMode}
            onSttModeChange={mode => setSettings(s => ({ ...s, sttMode: mode }))}
            appLanguage={settings.appLanguage}
            onAppLanguageChange={lang => setSettings(s => ({ ...s, appLanguage: lang, sttLanguage: lang }))}
            googleWebClientId={settings.googleWebClientId}
            onGoogleWebClientIdChange={id => changeServiceClientId('googleWebClientId', 'google', id)}
            spotifyClientId={settings.spotifyClientId}
            onSpotifyClientIdChange={id => changeServiceClientId('spotifyClientId', 'spotify', id)}
            slackClientId={settings.slackClientId}
            onSlackClientIdChange={id => changeServiceClientId('slackClientId', 'slack', id)}
            onTestSkill={handleTestSkill}
            ttsService={ttsService.current}
            onAddSkill={handleAddSkill}
            onDeleteSkill={handleDeleteSkill}
            dynamicSkillNames={dynamicSkillNames}
          />
        </SafeAreaProvider>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1 }, themeVars]}>
      <SafeAreaProvider>
        <HomeScreen
          onMicPress={handleMicPress}
          onTextSubmit={handleTextSubmit}
          pipelineState={pipelineState}
          drivingMode={settings.drivingMode}
          onToggleDrivingMode={handleToggleDrivingMode}
          onSettingsPress={() => setScreen('settings')}
          messages={messages}
          isDark={isDark}
          onToggleDarkMode={handleToggleDarkMode}
        />
      </SafeAreaProvider>
    </View>
  );
}

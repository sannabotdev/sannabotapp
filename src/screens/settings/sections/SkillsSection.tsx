import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import type { CredentialManager } from '../../../permissions/credential-manager';
import type { SkillInfo } from '../../../agent/skill-loader';
import { SettingRow } from '../components/SettingRow';
import { useNotificationAccess } from '../hooks/useNotificationAccess';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n';

const CATEGORY_ORDER = ['communication', 'productivity', 'information', 'media', 'other'] as const;
type SkillCategory = (typeof CATEGORY_ORDER)[number];

const CATEGORY_TRANSLATION_KEY: Record<SkillCategory, TranslationKey> = {
  communication: 'settings.skills.category.communication',
  productivity: 'settings.skills.category.productivity',
  information: 'settings.skills.category.information',
  media: 'settings.skills.category.media',
  other: 'settings.skills.category.other',
};

interface SkillsSectionProps {
  allSkills: SkillInfo[];
  enabledSkillNames: string[];
  skillAvailability: Record<string, boolean>;
  onToggleSkill: (skillName: string, enabled: boolean) => void;
  credentialManager: CredentialManager;
  skillCredentialStatus: Record<string, boolean>;
  checkSkillCredentials: () => Promise<void>;
  testingSkill: string | null;
  testResults: Record<
    string,
    {
      success: boolean;
      message: string;
      error?: string;
      evidence?: {
        toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
        toolResults: Array<{ toolName: string; result: string; isError: boolean }>;
        finalResponse?: string;
        iterations: number;
      };
    }
  >;
  handleTestSkill: (skill: SkillInfo) => Promise<void>;
  showEvidencePopup: (result: {
    success: boolean;
    message: string;
    error?: string;
    evidence?: {
      toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
      toolResults: Array<{ toolName: string; result: string; isError: boolean }>;
      finalResponse?: string;
      iterations: number;
    };
  }) => void;
  onTestSkill?: (skillName: string) => Promise<{
    success: boolean;
    message: string;
    error?: string;
    evidence?: {
      toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
      toolResults: Array<{ toolName: string; result: string; isError: boolean }>;
      finalResponse?: string;
      iterations: number;
    };
  }>;
  /** Called when user picks and confirms a SKILL.md upload. */
  onAddSkill?: (content: string) => Promise<{ success: boolean; error?: string }>;
  /** Called when user confirms deletion of a dynamic (uploaded) skill. */
  onDeleteSkill?: (skillName: string) => Promise<void>;
  /** Names of dynamically uploaded skills (for delete button visibility). */
  dynamicSkillNames?: string[];
}

export function SkillsSection({
  allSkills,
  enabledSkillNames,
  skillAvailability,
  onToggleSkill,
  credentialManager,
  skillCredentialStatus,
  checkSkillCredentials,
  testingSkill,
  testResults,
  handleTestSkill,
  showEvidencePopup,
  onTestSkill,
  onAddSkill,
  onDeleteSkill,
  dynamicSkillNames = [],
}: SkillsSectionProps): React.JSX.Element {
  const [showOnlyInstalled, setShowOnlyInstalled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { notificationAccessGranted, handleOpenNotificationSettings } =
    useNotificationAccess(enabledSkillNames);

  const handleConnectSkill = useCallback(
    async (skill: SkillInfo) => {
      if (!skill.credentials || skill.credentials.length === 0) return;
      try {
        for (const cred of skill.credentials) {
          await credentialManager.startSetup(cred);
        }
        await checkSkillCredentials();
      } catch (err) {
        Alert.alert(
          t('settings.skills.connectError.title'),
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [credentialManager, checkSkillCredentials],
  );

  const handleDisconnectSkill = useCallback(
    async (skill: SkillInfo) => {
      Alert.alert(
        t('settings.skills.disconnect.title').replace('{name}', skill.name),
        t('settings.skills.disconnect.message'),
        [
          { text: t('settings.skills.disconnect.cancel'), style: 'cancel' },
          {
            text: t('settings.skills.disconnect.confirm'),
            style: 'destructive',
            onPress: async () => {
              for (const cred of skill.credentials) {
                // OAuth tokens are stored under auth_provider key, not credential ID
                const key =
                  cred.type === 'oauth' && cred.auth_provider ? cred.auth_provider : cred.id;
                await credentialManager.revokeCredential(key);
              }
              await checkSkillCredentials();
            },
          },
        ],
      );
    },
    [credentialManager, checkSkillCredentials],
  );

  /** Open the system file picker, read the chosen .md file, and call onAddSkill */
  const handlePickSkillFile = useCallback(async () => {
    if (!onAddSkill) return;
    try {
      // pick() with mode:'import' copies the file into the app cache –
      // the returned uri is a local file:// path readable via fetch()
      const [result] = await pick({
        type: [types.plainText, 'text/markdown'],
        mode: 'import',
      });

      if (!result?.uri) {
        Alert.alert('Upload Error', 'Could not read the selected file.');
        return;
      }

      setUploading(true);
      let content: string;
      try {
        const response = await fetch(result.uri);
        content = await response.text();
      } finally {
        setUploading(false);
      }

      const outcome = await onAddSkill(content);
      if (!outcome.success) {
        Alert.alert('Invalid Skill', outcome.error ?? 'Unknown validation error.');
      }
    } catch (err) {
      // User cancelled – silently ignore
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        setUploading(false);
        return;
      }
      Alert.alert('Upload Error', err instanceof Error ? err.message : String(err));
      setUploading(false);
    }
  }, [onAddSkill]);

  /** Confirm and delete a dynamic skill */
  const handleDeleteSkill = useCallback(
    (skill: SkillInfo) => {
      Alert.alert(
        `Delete "${skill.name}"?`,
        'This custom skill will be removed. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await onDeleteSkill?.(skill.name);
            },
          },
        ],
      );
    },
    [onDeleteSkill],
  );

  /** Render a single skill row */
  const renderSkillRow = (skill: (typeof allSkills)[number]) => {
    const isEnabled = enabledSkillNames.includes(skill.name);
    const isConfigured = skillCredentialStatus[skill.name] ?? true;
    const hasCredentials = skill.credentials.length > 0;
    const isInstalled = skillAvailability[skill.name] ?? true;
    const testResult = testResults[skill.name];
    const notInstalledReason: 'app' | 'config' | null = isInstalled
      ? null
      : skill.android_package
        ? 'app'
        : 'config';

    const isDynamic = dynamicSkillNames.includes(skill.name);

    const showConnectIcon = isEnabled && isInstalled && hasCredentials && !isConfigured;
    const showDisconnectIcon = isEnabled && isInstalled && hasCredentials && isConfigured;
    const showTestIcon = isEnabled && isInstalled && !!skill.testPrompt && isConfigured && !!onTestSkill;

    return (
      <View
        key={skill.name}
        className="p-4 border-b border-surface-tertiary"
        style={[
          { borderBottomWidth: StyleSheet.hairlineWidth },
          !isInstalled && { opacity: 0.5 },
        ]}>
        {/* Row 1: Name + Badges + Icon actions + Switch */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1 flex-wrap">
            <Text className="text-label-primary text-[15px] font-semibold capitalize">
              {skill.name}
            </Text>
            {isDynamic && (
              <View className="px-2 py-0.5 rounded-full bg-blue-500/20">
                <Text className="text-[10px] font-semibold text-blue-400">custom</Text>
              </View>
            )}
            {!isInstalled ? (
              <View className="px-2 py-0.5 rounded-full bg-red-500/20">
                <Text className="text-[10px] font-semibold text-red-400">
                  {notInstalledReason === 'config'
                    ? t('settings.skills.badge.notConfigured')
                    : t('settings.skills.badge.notInstalled')}
                </Text>
              </View>
            ) : isEnabled && hasCredentials ? (
              <View
                className={`px-2 py-0.5 rounded-full ${
                  isConfigured ? 'bg-green-500/15' : 'bg-orange-500/15'
                }`}>
                <Text
                  className={`text-[10px] font-semibold ${
                    isConfigured ? 'text-green-400' : 'text-orange-400'
                  }`}>
                  {isConfigured
                    ? t('settings.skills.badge.connected')
                    : t('settings.skills.badge.setupNeeded')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Icon action buttons + Switch */}
          <View className="flex-row items-center gap-1.5">
            {/* Connect icon (shown when credentials missing) */}
            {showConnectIcon && (
              <TouchableOpacity
                onPress={() => handleConnectSkill(skill)}
                style={{ width: 28, height: 28 }}
                className="rounded-full bg-accent items-center justify-center">
                <Text className="text-white text-[14px] leading-none">⊕</Text>
              </TouchableOpacity>
            )}
            {/* Disconnect icon */}
            {showDisconnectIcon && (
              <TouchableOpacity
                onPress={() => handleDisconnectSkill(skill)}
                style={{ width: 28, height: 28 }}
                className="rounded-full bg-surface-tertiary items-center justify-center">
                <Text className="text-label-primary text-[13px] leading-none">⊗</Text>
              </TouchableOpacity>
            )}
            {/* Test icon / spinner */}
            {showTestIcon && (
              <TouchableOpacity
                onPress={() => handleTestSkill(skill)}
                disabled={testingSkill === skill.name}
                style={{ width: 28, height: 28 }}
                className="rounded-full bg-surface-tertiary items-center justify-center">
                {testingSkill === skill.name ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-label-primary text-[13px] leading-none">▷</Text>
                )}
              </TouchableOpacity>
            )}
            {/* Test result dot */}
            {testResult && (
              <TouchableOpacity
                onPress={() => testResult.evidence && showEvidencePopup(testResult)}
                disabled={!testResult.evidence}
                style={{ width: 20, height: 20 }}
                className="items-center justify-center">
                <Text
                  className={`text-[13px] leading-none font-bold ${
                    testResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                  {testResult.success ? '✓' : '✗'}
                </Text>
              </TouchableOpacity>
            )}
            {/* Delete icon (dynamic skills only) */}
            {isDynamic && onDeleteSkill && (
              <TouchableOpacity
                onPress={() => handleDeleteSkill(skill)}
                style={{ width: 28, height: 28 }}
                className="rounded-full bg-red-500/15 items-center justify-center">
                <Text className="text-red-400 text-[13px] leading-none">✕</Text>
              </TouchableOpacity>
            )}
            <Switch
              value={isEnabled}
              onValueChange={v => onToggleSkill(skill.name, v)}
              disabled={!isInstalled}
              trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Row 2: Description */}
        <Text className="text-label-secondary text-xs mt-1">{skill.description}</Text>

        {/* Row 3: Not-available hint */}
        {notInstalledReason === 'app' && (
          <Text className="text-label-tertiary text-[11px] mt-1">
            {t('settings.skills.requires').replace('{package}', skill.android_package ?? '')}
          </Text>
        )}
        {notInstalledReason === 'config' && (
          <Text className="text-label-tertiary text-[11px] mt-1">
            {t('settings.skills.clientIdMissing')}
          </Text>
        )}

        {/* Row 3.5: Notification access status (for notifications skill) */}
        {skill.name === 'notifications' && isEnabled && Platform.OS === 'android' && (
          <View className="mt-2">
            {notificationAccessGranted === null ? (
              <Text className="text-label-tertiary text-[11px]">
                {t('settings.skills.notification.checking')}
              </Text>
            ) : notificationAccessGranted ? (
              <View className="flex-row items-center gap-1">
                <Text className="text-green-400 text-[11px]">✓</Text>
                <Text className="text-label-secondary text-[11px]">
                  {t('settings.skills.notification.granted')}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Text className="text-orange-400 text-[11px]">⚠</Text>
                <Text className="text-label-secondary text-[11px] flex-1">
                  {t('settings.skills.notification.denied')}
                </Text>
                <TouchableOpacity
                  className="px-3 py-1 rounded-lg bg-accent"
                  onPress={handleOpenNotificationSettings}>
                  <Text className="text-white text-[11px] font-medium">
                    {t('settings.skills.notification.allowButton')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Group skills by category, respecting the active filter
  const filteredSkills = allSkills.filter(skill => {
    if (showOnlyInstalled) {
      return skillAvailability[skill.name] ?? true;
    }
    return true;
  });

  const skillsByCategory = CATEGORY_ORDER.reduce<Record<string, typeof allSkills>>(
    (acc, cat) => {
      acc[cat] = filteredSkills.filter(s => (s.category ?? 'other') === cat);
      return acc;
    },
    {},
  );

  return (
    <>
      {/* Upload new skill button */}
      {onAddSkill && (
        <View className="px-4 py-3 border-b border-surface-tertiary" style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 py-2 px-4 rounded-xl bg-accent"
            onPress={handlePickSkillFile}
            disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white text-sm font-semibold">+ Add Skill from File</Text>
            )}
          </TouchableOpacity>
          <Text className="text-label-tertiary text-[11px] mt-1 text-center">
            Select a SKILL.md file from your device
          </Text>
        </View>
      )}

      {/* Filter toggle */}
      <SettingRow
        label={t('settings.skills.filterLabel')}
        description={t('settings.skills.filterDesc')}>
        <Switch
          value={showOnlyInstalled}
          onValueChange={setShowOnlyInstalled}
          trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
          thumbColor="#FFFFFF"
        />
      </SettingRow>

      {/* Skills grouped by category */}
      {CATEGORY_ORDER.map(cat => {
        const skills = skillsByCategory[cat];
        if (!skills || skills.length === 0) return null;
        return (
          <View key={cat}>
            {/* Category header */}
            <View
              className="px-4 pt-4 pb-1 bg-surface-elevated"
              style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
              accessible={false}>
              <Text className="text-label-secondary text-xs font-semibold uppercase tracking-widest">
                {t(CATEGORY_TRANSLATION_KEY[cat])}
              </Text>
            </View>
            {/* Skill rows */}
            {skills.map(skill => renderSkillRow(skill))}
          </View>
        );
      })}
    </>
  );
}

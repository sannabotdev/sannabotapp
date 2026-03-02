/**
 * NotificationListenersScreen – View and manage all notification listener rules
 *
 * Loads all rules from the NotificationRulesStore and displays them as
 * collapsible entries with details and a delete button.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { MarkdownText } from '../components/MarkdownText';
import { deleteRule, loadRules, updateRule, type NotificationRule } from '../agent/notification-rules-store';

interface NotificationListenersScreenProps {
  onBack: () => void;
  enabledSkillNames: string[];
  isDark: boolean;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationListenersScreen({
  onBack,
  enabledSkillNames,
  isDark,
}: NotificationListenersScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const isSkillEnabled = enabledSkillNames.includes('notifications');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadRules();
      loaded.sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setRules(loaded);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSkillEnabled) {
      loadData();
    }
  }, [loadData, isSkillEnabled]);

  const handleToggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleToggleEnabled = async (rule: NotificationRule) => {
    await updateRule(rule.id, { enabled: !rule.enabled });
    await loadData();
  };

  const handleDelete = (rule: NotificationRule) => {
    Alert.alert(
      t('notifListeners.delete.title'),
      t('notifListeners.delete.message'),
      [
        { text: t('notifListeners.delete.cancel'), style: 'cancel' },
        {
          text: t('notifListeners.delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            await deleteRule(rule.id);
            if (expandedId === rule.id) setExpandedId(null);
            await loadData();
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-surface-elevated gap-3">
        <TouchableOpacity onPress={onBack} className="p-1">
          <Text className="text-accent text-base">{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text className="text-label-primary text-lg font-bold">{t('notifListeners.title')}</Text>
      </View>

      {!isSkillEnabled ? (
        <View className="flex-1 items-center justify-center px-8">
          <MarkdownText isDark={isDark}>{t('notifListeners.skillDisabled')}</MarkdownText>
        </View>
      ) : loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : rules.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-label-secondary text-base text-center">
            {t('notifListeners.empty')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          {rules.map(rule => {
            const isExpanded = expandedId === rule.id;
            return (
              <View key={rule.id} className="bg-surface-elevated rounded-xl overflow-hidden">
                {/* Rule header row */}
                <View className="flex-row items-center px-4 py-3 gap-3">
                  <TouchableOpacity
                    onPress={() => handleToggle(rule.id)}
                    activeOpacity={0.7}
                    className="flex-row items-center flex-1 gap-3">
                    <Text className="text-label-secondary text-lg">
                      {isExpanded ? '▾' : '▸'}
                    </Text>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-label-primary text-sm font-semibold">
                        {rule.appLabel}
                      </Text>
                      <Text
                        className="text-label-secondary text-xs"
                        numberOfLines={1}>
                        {rule.instruction}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(rule)}
                    activeOpacity={0.7}
                    style={{ width: 28, height: 28 }}
                    className="rounded-full bg-red-500/15 items-center justify-center">
                    <Text className="text-red-400 text-[13px] leading-none">🗑️</Text>
                  </TouchableOpacity>
                  <Switch
                    value={rule.enabled}
                    onValueChange={() => handleToggleEnabled(rule)}
                    trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Expanded content */}
                {isExpanded && (
                  <View className="border-t border-surface px-4 py-3 gap-2">
                    <DetailRow label={t('notifListeners.detail.app')} value={`${rule.appLabel} (${rule.app})`} />
                    <DetailRow label={t('notifListeners.detail.instruction')} value={rule.instruction} />
                    <DetailRow
                      label={t('notifListeners.detail.condition')}
                      value={rule.condition || t('notifListeners.detail.conditionAlways')}
                    />
                    <DetailRow
                      label={t('notifListeners.detail.status')}
                      value={rule.enabled ? t('notifListeners.status.active') : t('notifListeners.status.disabled')}
                    />
                    <DetailRow label={t('notifListeners.detail.createdAt')} value={formatDate(rule.created_at)} />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-row gap-2">
      <Text className="text-label-secondary text-xs w-24 shrink-0">{label}</Text>
      <Text className="text-label-primary text-xs flex-1">{value}</Text>
    </View>
  );
}

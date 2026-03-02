/**
 * SchedulesScreen – View and manage all scheduler entries
 *
 * Loads all schedules from the native SchedulerModule and displays them
 * as collapsible entries with details and a delete button.
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { MarkdownText } from '../components/MarkdownText';
import SchedulerModule from '../native/SchedulerModule';
import type { Schedule } from '../tools/scheduler-tool';

interface SchedulesScreenProps {
  onBack: () => void;
  enabledSkillNames: string[];
  isDark: boolean;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRecurrence(s: Schedule): string {
  const r = s.recurrence;
  switch (r.type) {
    case 'once':
      return t('schedules.recurrence.once');
    case 'interval': {
      const minutes = Math.round((r.intervalMs ?? 0) / 60_000);
      if (minutes < 60) {
        return t('schedules.recurrence.interval.minutes').replace('{count}', String(minutes));
      }
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (mins > 0) {
        return t('schedules.recurrence.interval.hoursMinutes')
          .replace('{hours}', String(hours))
          .replace('{minutes}', String(mins));
      }
      return t('schedules.recurrence.interval.hours').replace('{hours}', String(hours));
    }
    case 'daily':
      return t('schedules.recurrence.daily').replace('{time}', r.time ?? '?');
    case 'weekly': {
      const dayNames = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
      const days = (r.daysOfWeek ?? []).map(d => dayNames[d] ?? '?').join(', ');
      return t('schedules.recurrence.weekly')
        .replace('{days}', days)
        .replace('{time}', r.time ?? '?');
    }
    default:
      return r.type;
  }
}

export function SchedulesScreen({ onBack, enabledSkillNames, isDark }: SchedulesScreenProps): React.JSX.Element {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const isSkillEnabled = enabledSkillNames.includes('scheduler');

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const json = await SchedulerModule.getAllSchedules();
      const parsed = JSON.parse(json) as Schedule[];
      parsed.sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return a.triggerAtMs - b.triggerAtMs;
      });
      setSchedules(parsed);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSkillEnabled) {
      loadSchedules();
    }
  }, [loadSchedules, isSkillEnabled]);

  const handleToggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleToggleEnabled = async (schedule: Schedule) => {
    schedule.enabled = !schedule.enabled;
    await SchedulerModule.setSchedule(JSON.stringify(schedule));
    await loadSchedules();
  };

  const handleDelete = (schedule: Schedule) => {
    Alert.alert(
      t('schedules.delete.title'),
      t('schedules.delete.message'),
      [
        { text: t('schedules.delete.cancel'), style: 'cancel' },
        {
          text: t('schedules.delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            await SchedulerModule.removeSchedule(schedule.id);
            if (expandedId === schedule.id) setExpandedId(null);
            await loadSchedules();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-surface-elevated gap-3">
        <TouchableOpacity onPress={onBack} className="p-1">
          <Text className="text-accent text-base">{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text className="text-label-primary text-lg font-bold">{t('schedules.title')}</Text>
      </View>

      {!isSkillEnabled ? (
        <View className="flex-1 items-center justify-center px-8">
          <MarkdownText isDark={isDark}>{t('schedules.skillDisabled')}</MarkdownText>
        </View>
      ) : loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : schedules.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-label-secondary text-base text-center">
            {t('schedules.empty')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          {schedules.map(schedule => {
            const isExpanded = expandedId === schedule.id;
            return (
              <View key={schedule.id} className="bg-surface-elevated rounded-xl overflow-hidden">
                {/* Schedule header row */}
                <View className="flex-row items-center px-4 py-3 gap-3">
                  <TouchableOpacity
                    onPress={() => handleToggle(schedule.id)}
                    activeOpacity={0.7}
                    className="flex-row items-center flex-1 gap-3">
                    <Text className="text-label-secondary text-lg">
                      {isExpanded ? '▾' : '▸'}
                    </Text>
                    <View className="flex-1 gap-0.5">
                      <Text
                        className="text-label-primary text-sm font-semibold"
                        numberOfLines={2}>
                        {schedule.label || schedule.instruction}
                      </Text>
                      <Text className="text-label-secondary text-xs">
                        {formatDate(schedule.triggerAtMs)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(schedule)}
                    activeOpacity={0.7}
                    style={{ width: 28, height: 28 }}
                    className="rounded-full bg-red-500/15 items-center justify-center">
                    <Text className="text-red-400 text-[13px] leading-none">🗑️</Text>
                  </TouchableOpacity>
                  <Switch
                    value={schedule.enabled}
                    onValueChange={() => handleToggleEnabled(schedule)}
                    trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Expanded content */}
                {isExpanded && (
                  <View className="border-t border-surface px-4 py-3 gap-2">
                    {schedule.label && (
                      <DetailRow label={t('schedules.detail.label')} value={schedule.label} />
                    )}
                    <DetailRow label={t('schedules.detail.instruction')} value={schedule.instruction} />
                    <DetailRow label={t('schedules.detail.triggerAt')} value={formatDate(schedule.triggerAtMs)} />
                    <DetailRow label={t('schedules.detail.recurrence')} value={formatRecurrence(schedule)} />
                    <DetailRow
                      label={t('schedules.detail.status')}
                      value={schedule.enabled ? t('schedules.status.active') : t('schedules.status.disabled')}
                    />
                    <DetailRow label={t('schedules.detail.createdAt')} value={formatDate(schedule.createdAt)} />
                    {schedule.lastExecutedAt && (
                      <DetailRow
                        label={t('schedules.detail.lastExecuted')}
                        value={formatDate(schedule.lastExecutedAt)}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-row gap-2">
      <Text className="text-label-secondary text-xs w-32 shrink-0">{label}</Text>
      <Text className="text-label-primary text-xs flex-1">{value}</Text>
    </View>
  );
}

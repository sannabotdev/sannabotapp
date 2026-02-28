/**
 * SkillSummaryModal – View and delete skill summary for a specific skill.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SkillSummaryCache } from '../../../agent/skill-summary-cache';
import type { SkillInfo } from '../../../agent/skill-loader';
import { t } from '../../../i18n';

interface SkillSummaryModalProps {
  visible: boolean;
  skill: SkillInfo | null;
  onClose: () => void;
  onSummaryDeleted?: (skillName: string) => void;
}

export function SkillSummaryModal({
  visible,
  skill,
  onClose,
  onSummaryDeleted,
}: SkillSummaryModalProps): React.JSX.Element {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!skill) {
      setSummary(null);
      setLoading(false);
      return;
    }
    
    // First, check if summary is already in the skill object
    if (skill.summary && skill.summary.trim().length > 0) {
      setSummary(skill.summary);
      setLoading(false);
      return;
    }
    
    // Otherwise, try to load from AsyncStorage
    setLoading(true);
    try {
      const loaded = await SkillSummaryCache.getRawSummary(skill.name);
      setSummary(loaded);
    } catch (err) {
      console.warn('[SkillSummaryModal] Failed to load summary:', err);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [skill]);

  useEffect(() => {
    if (visible && skill) {
      loadSummary();
    } else {
      setSummary(null);
      setLoading(false);
    }
  }, [visible, skill, loadSummary]);

  const handleDelete = useCallback(() => {
    if (!skill) return;
    Alert.alert(
      t('settings.skills.summary.deleteConfirm.title'),
      t('settings.skills.summary.deleteConfirm.message').replace('{name}', skill.name),
      [
        { text: t('settings.skills.summary.deleteConfirm.cancel'), style: 'cancel' },
        {
          text: t('settings.skills.summary.deleteConfirm.confirm'),
          style: 'destructive',
          onPress: async () => {
            await SkillSummaryCache.clearSummary(skill.name);
            setSummary(null);
            onSummaryDeleted?.(skill.name);
            onClose();
          },
        },
      ],
    );
  }, [skill, onSummaryDeleted, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      {/* Scrim */}
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-center items-center"
        activeOpacity={1}
        onPress={onClose}>
        {/* Panel – stop touch propagation */}
        <View
          className="bg-surface rounded-2xl w-[92%] max-w-[540px] overflow-hidden"
          style={{ maxHeight: '80%' }}>
          {/* Header */}
          <View className="px-5 py-4 border-b border-surface-elevated flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-label-primary text-base font-bold">
                {t('settings.skills.summary.title')}
              </Text>
              <Text className="text-label-secondary text-xs mt-0.5">
                {skill?.name ?? ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Text className="text-accent text-sm font-medium">{t('settings.skills.summary.close')}</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : !summary || summary.trim().length === 0 ? (
            <View className="py-10 px-6 items-center">
              <Text className="text-label-secondary text-sm text-center">
                {t('settings.skills.summary.empty')}
              </Text>
            </View>
          ) : (
            <ScrollView 
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={true}>
              <Text className="text-label-primary text-sm leading-relaxed">
                {summary}
              </Text>
              <TouchableOpacity
                onPress={handleDelete}
                activeOpacity={0.7}
                className="mt-4 py-3 rounded-xl bg-red-500/15 items-center">
                <Text className="text-red-400 text-sm font-semibold">
                  {t('settings.skills.summary.delete')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

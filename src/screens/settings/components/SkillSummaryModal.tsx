/**
 * SkillSummaryModal – View and delete skill summary for a specific skill.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  onSummaryReloaded?: (skillName: string) => void;
}

export function SkillSummaryModal({
  visible,
  skill,
  onClose,
  onSummaryReloaded,
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

  const handleReload = useCallback(async () => {
    if (!skill || loading) return;
    setLoading(true);
    try {
      await onSummaryReloaded?.(skill.name);
      // Reload summary after regeneration
      await loadSummary();
    } catch {
      setLoading(false);
    }
  }, [skill, onSummaryReloaded, loadSummary, loading]);

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
        <TouchableOpacity
          className="bg-surface rounded-2xl w-[92%] max-w-[540px] overflow-hidden"
          style={{ maxHeight: '80%' }}
          activeOpacity={1}
          onPress={() => {}}>
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
            <View className="flex-row items-center gap-2">
              {summary && summary.trim().length > 0 && (
                <TouchableOpacity
                  onPress={handleReload}
                  disabled={loading}
                  style={{ width: 28, height: 28 }}
                  className="rounded-full bg-surface-tertiary items-center justify-center"
                  activeOpacity={0.7}>
                  <Text className="text-label-primary text-[13px] leading-none">⟳</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} className="p-1">
                <Text className="text-accent text-sm font-medium">{t('settings.skills.summary.close')}</Text>
              </TouchableOpacity>
            </View>
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
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={true}>
              <Text className="text-label-primary text-sm leading-relaxed">
                {summary}
              </Text>
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

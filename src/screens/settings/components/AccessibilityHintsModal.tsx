/**
 * AccessibilityHintsModal – View and delete stored accessibility hints per app.
 *
 * Hints are LLM-condensed interaction knowledge stored by AccessibilityHintStore
 * under the key prefix `accessibility_hint_`. Each entry corresponds to one
 * app package (e.g. com.whatsapp). The modal shows a collapsible list of all
 * stored hints so the user can inspect or delete them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { t } from '../../../i18n';

const HINT_KEY_PREFIX = 'accessibility_hint_';

interface HintEntry {
  /** Raw AsyncStorage key suffix, underscores instead of dots */
  keySuffix: string;
  /** Display label: underscores replaced back with dots */
  packageName: string;
  /** The stored hint text */
  hint: string;
}

interface AccessibilityHintsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AccessibilityHintsModal({
  visible,
  onClose,
}: AccessibilityHintsModalProps): React.JSX.Element {
  const [entries, setEntries] = useState<HintEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const loadHints = useCallback(async () => {
    setLoading(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const hintKeys = (allKeys as readonly string[]).filter(k =>
        k.startsWith(HINT_KEY_PREFIX),
      );
      const loaded: HintEntry[] = [];
      for (const key of hintKeys) {
        const keySuffix = key.slice(HINT_KEY_PREFIX.length);
        const packageName = keySuffix.replace(/_/g, '.');
        const hint = (await AsyncStorage.getItem(key)) ?? '';
        loaded.push({ keySuffix, packageName, hint });
      }
      loaded.sort((a, b) => a.packageName.localeCompare(b.packageName));
      setEntries(loaded);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadHints();
      setExpandedKey(null);
    }
  }, [visible, loadHints]);

  const handleToggle = (keySuffix: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey(prev => (prev === keySuffix ? null : keySuffix));
  };

  const handleDelete = (entry: HintEntry) => {
    Alert.alert(
      t('accessibilityHints.delete.title'),
      t('accessibilityHints.delete.message'),
      [
        { text: t('accessibilityHints.delete.cancel'), style: 'cancel' },
        {
          text: t('accessibilityHints.delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(`${HINT_KEY_PREFIX}${entry.keySuffix}`);
            if (expandedKey === entry.keySuffix) setExpandedKey(null);
            await loadHints();
          },
        },
      ],
    );
  };

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
            <Text className="text-label-primary text-base font-bold">
              {t('accessibilityHints.title')}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Text className="text-accent text-sm font-medium">
                {t('accessibilityHints.close')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : entries.length === 0 ? (
            <View className="py-10 px-6 items-center">
              <Text className="text-label-secondary text-sm text-center">
                {t('accessibilityHints.empty')}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 16 }}>
              {entries.map(entry => {
                const isExpanded = expandedKey === entry.keySuffix;
                return (
                  <View
                    key={entry.keySuffix}
                    className="bg-surface-elevated rounded-xl overflow-hidden">
                    {/* Row header */}
                    <TouchableOpacity
                      onPress={() => handleToggle(entry.keySuffix)}
                      activeOpacity={0.7}
                      className="flex-row items-center px-4 py-3 gap-3">
                      <Text className="text-label-secondary text-base">
                        {isExpanded ? '▾' : '▸'}
                      </Text>
                      <Text
                        className="flex-1 text-label-primary text-sm font-semibold"
                        numberOfLines={1}>
                        {entry.packageName}
                      </Text>
                    </TouchableOpacity>

                    {/* Expanded: hint text + delete */}
                    {isExpanded && (
                      <View className="border-t border-surface px-4 pb-3 pt-2 gap-3">
                        <Text className="text-label-secondary text-xs leading-relaxed">
                          {entry.hint || '—'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDelete(entry)}
                          activeOpacity={0.7}
                          className="py-2 rounded-xl bg-accent-red items-center">
                          <Text className="text-white text-xs font-semibold">
                            {t('accessibilityHints.deleteButton')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

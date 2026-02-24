import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { t } from '../../../i18n';

interface AboutSectionProps {
  onClearHistory?: () => void;
}

export function AboutSection({ onClearHistory }: AboutSectionProps): React.JSX.Element {
  const handleClearHistory = () => {
    Alert.alert(
      t('settings.clearHistory.confirm.title'),
      t('settings.clearHistory.confirm.message'),
      [
        { text: t('settings.clearHistory.confirm.cancel'), style: 'cancel' },
        {
          text: t('settings.clearHistory.confirm.confirm'),
          style: 'destructive',
          onPress: onClearHistory,
        },
      ],
    );
  };

  return (
    <>
      <View
        className="p-4 border-b border-surface-tertiary"
        style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
        <Text className="text-label-secondary text-[13px]">Version 0.1.0 (Phase 1 MVP)</Text>
      </View>

      {onClearHistory && (
        <View
          className="p-4"
          style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' }}>
          <TouchableOpacity
            onPress={handleClearHistory}
            className="py-2.5 px-4 rounded-xl bg-red-500/10 items-center">
            <Text className="text-red-500 text-sm font-semibold">
              {t('settings.clearHistory.button')}
            </Text>
          </TouchableOpacity>
          <Text className="text-label-tertiary text-[11px] mt-1.5 text-center">
            {t('settings.clearHistory.description')}
          </Text>
        </View>
      )}
    </>
  );
}

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { t } from '../../../i18n';

interface ModeSelectorProps {
  value: 'auto' | 'offline' | 'online';
  onChange: (mode: 'auto' | 'offline' | 'online') => void;
}

export function ModeSelector({
  value,
  onChange,
}: ModeSelectorProps): React.JSX.Element {
  const modes: Array<{ value: 'auto' | 'offline' | 'online'; labelKey: string; descKey: string }> = [
    { value: 'auto', labelKey: 'settings.speech.mode.auto', descKey: 'settings.speech.mode.auto.desc' },
    { value: 'offline', labelKey: 'settings.speech.mode.offline', descKey: 'settings.speech.mode.offline.desc' },
    { value: 'online', labelKey: 'settings.speech.mode.online', descKey: 'settings.speech.mode.online.desc' },
  ];

  return (
    <View className="p-4 border-t border-surface-tertiary">
      <Text className="text-label-secondary text-xs font-medium mb-3">
        {t('settings.speech.modeLabel')}
      </Text>
      <View className="flex-row gap-2">
        {modes.map(mode => (
          <TouchableOpacity
            key={mode.value}
            onPress={() => onChange(mode.value)}
            className={`flex-1 rounded-lg py-2.5 px-3 border ${
              value === mode.value
                ? 'bg-accent border-accent'
                : 'bg-surface-tertiary border-surface-tertiary'
            }`}>
            <Text
              className={`text-sm font-medium text-center ${
                value === mode.value ? 'text-white' : 'text-label-primary'
              }`}>
              {t(mode.labelKey as Parameters<typeof t>[0])}
            </Text>
            <Text
              className={`text-xs text-center mt-0.5 ${
                value === mode.value ? 'text-white/80' : 'text-label-secondary'
              }`}>
              {t(mode.descKey as Parameters<typeof t>[0])}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

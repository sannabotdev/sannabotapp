import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { t } from '../../../i18n';

interface ProviderToggleProps {
  selected: 'claude' | 'openai' | 'custom';
  onChange: (p: 'claude' | 'openai' | 'custom') => void;
}

export function ProviderToggle({
  selected,
  onChange,
}: ProviderToggleProps): React.JSX.Element {
  return (
    <View className="m-3">
      <View className="flex-row gap-2">
        {(['openai', 'claude', 'custom'] as const).map(p => {
          const isDisabled = p === 'claude';
          return (
            <TouchableOpacity
              key={p}
              className={`flex-1 py-2.5 px-3 rounded-lg items-center ${
                selected === p ? 'bg-accent' : 'bg-surface-tertiary'
              } ${isDisabled ? 'opacity-50' : ''}`}
              onPress={() => !isDisabled && onChange(p)}
              disabled={isDisabled}
            >
              <Text
                className={`text-sm font-medium ${
                  selected === p ? 'text-label-primary' : 'text-label-secondary'
                }`}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {p === 'openai'
                  ? '🤖 OpenAI'
                  : p === 'claude'
                  ? '🧠 Claude'
                  : '⚙️ Custom'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text className="text-xs text-label-secondary text-center mt-1">
        {selected === 'claude'
          ? t('settings.provider.claudeComingSoon')
          : t('settings.provider.customDescription')}
      </Text>
    </View>
  );
}

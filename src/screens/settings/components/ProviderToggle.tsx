import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { t } from '../../../i18n';

interface ProviderToggleProps {
  selected: 'claude' | 'openai';
  onChange: (p: 'claude' | 'openai') => void;
}

export function ProviderToggle({
  selected,
  onChange,
}: ProviderToggleProps): React.JSX.Element {
  return (
    <View className="m-3">
      <View className="flex-row gap-2">
        {(['claude', 'openai'] as const).map(p => {
          const isClaude = p === 'claude';
          const isDisabled = isClaude;
          return (
            <TouchableOpacity
              key={p}
              className={`flex-1 py-2.5 px-4 rounded-lg items-center ${
                selected === p ? 'bg-accent' : 'bg-surface-tertiary'
              } ${isDisabled ? 'opacity-50' : ''}`}
              onPress={() => !isDisabled && onChange(p)}
              disabled={isDisabled}>
              <Text
                className={`text-sm font-medium ${
                  selected === p ? 'text-label-primary' : 'text-label-secondary'
                }`}>
                {p === 'claude' ? '🧠 Claude' : '🤖 OpenAI'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text className="text-xs text-label-secondary text-center mt-1">
        {t('settings.provider.claudeComingSoon')}
      </Text>
    </View>
  );
}

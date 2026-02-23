import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ProviderToggleProps {
  selected: 'claude' | 'openai';
  onChange: (p: 'claude' | 'openai') => void;
}

export function ProviderToggle({
  selected,
  onChange,
}: ProviderToggleProps): React.JSX.Element {
  return (
    <View className="flex-row m-3 gap-2">
      {(['claude', 'openai'] as const).map(p => (
        <TouchableOpacity
          key={p}
          className={`flex-1 py-2.5 px-4 rounded-lg items-center ${
            selected === p ? 'bg-accent' : 'bg-surface-tertiary'
          }`}
          onPress={() => onChange(p)}>
          <Text
            className={`text-sm font-medium ${
              selected === p ? 'text-label-primary' : 'text-label-secondary'
            }`}>
            {p === 'claude' ? '🧠 Claude' : '🤖 OpenAI'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

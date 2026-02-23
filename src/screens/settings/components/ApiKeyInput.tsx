import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

interface ApiKeyInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
}

export function ApiKeyInput({
  label,
  value,
  onChange,
  placeholder,
  visible,
}: ApiKeyInputProps): React.JSX.Element | null {
  if (!visible) return null;
  return (
    <View
      className="p-4 gap-2 border-t border-surface-tertiary"
      style={{ borderTopWidth: StyleSheet.hairlineWidth }}>
      <Text className="text-label-secondary text-xs font-medium">{label}</Text>
      <TextInput
        className="bg-surface-tertiary rounded-lg px-3 py-2.5 text-label-primary text-sm"
        style={{ fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo' }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#636366"
        secureTextEntry={true}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

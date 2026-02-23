import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingRow({
  label,
  description,
  children,
}: SettingRowProps): React.JSX.Element {
  return (
    <View
      className="flex-row justify-between items-center p-4 border-b border-surface-tertiary"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
      <View className="flex-1 mr-3">
        <Text className="text-label-primary text-[15px] font-medium">{label}</Text>
        {description && <Text className="text-label-secondary text-xs mt-0.5">{description}</Text>}
      </View>
      {children}
    </View>
  );
}

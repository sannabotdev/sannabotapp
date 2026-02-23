import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function AboutSection(): React.JSX.Element {
  return (
    <View
      className="p-4 border-b border-surface-tertiary"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
      <Text className="text-label-secondary text-[13px]">Version 0.1.0 (Phase 1 MVP)</Text>
    </View>
  );
}

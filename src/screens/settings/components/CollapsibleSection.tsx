import React from 'react';
import { LayoutAnimation, Text, TouchableOpacity, View } from 'react-native';

interface CollapsibleSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps): React.JSX.Element {
  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  return (
    <View className="gap-2">
      <TouchableOpacity
        onPress={handleToggle}
        className="flex-row justify-between items-center py-2">
        <Text className="text-label-secondary text-[13px] font-semibold uppercase tracking-wide">
          {title}
        </Text>
        <Text className="text-label-secondary text-lg">
          {expanded ? '▾' : '▸'}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View className="bg-surface-elevated rounded-xl overflow-hidden">
          {children}
        </View>
      )}
    </View>
  );
}

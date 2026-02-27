import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { t } from '../../../i18n';

interface AgentSectionProps {
  maxIterations: number;
  onMaxIterationsChange: (value: number) => void;
  maxSubAgentIterations: number;
  onMaxSubAgentIterationsChange: (value: number) => void;
  maxAccessibilityIterations: number;
  onMaxAccessibilityIterationsChange: (value: number) => void;
}

function IterationStepper({
  label,
  description,
  value,
  onChange,
  min = 1,
  max = 50,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}): React.JSX.Element {
  return (
    <View
      className="px-4 py-3 border-b border-surface-tertiary"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
      <View className="flex-row items-center justify-between">
        {/* Label + description */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text className="text-label-primary text-[15px] font-medium">{label}</Text>
          <Text className="text-label-secondary text-[12px] mt-0.5">{description}</Text>
        </View>

        {/* Stepper: − value + */}
        <View className="flex-row items-center gap-1">
          <TouchableOpacity
            onPress={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="w-8 h-8 rounded-full bg-surface-tertiary items-center justify-center"
            activeOpacity={0.7}>
            <Text
              className="text-label-primary text-lg font-bold"
              style={{ lineHeight: 22 }}>
              −
            </Text>
          </TouchableOpacity>

          <Text
            className="text-label-primary text-base font-semibold text-center"
            style={{ width: 32 }}>
            {value}
          </Text>

          <TouchableOpacity
            onPress={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="w-8 h-8 rounded-full bg-surface-tertiary items-center justify-center"
            activeOpacity={0.7}>
            <Text
              className="text-label-primary text-lg font-bold"
              style={{ lineHeight: 22 }}>
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function AgentSection({
  maxIterations,
  onMaxIterationsChange,
  maxSubAgentIterations,
  onMaxSubAgentIterationsChange,
  maxAccessibilityIterations,
  onMaxAccessibilityIterationsChange,
}: AgentSectionProps): React.JSX.Element {
  return (
    <>
      <View
        className="px-4 py-2 border-b border-surface-tertiary"
        style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
        <Text className="text-label-secondary text-[12px]">
          {t('settings.agent.description')}
        </Text>
      </View>

      <IterationStepper
        label={t('settings.agent.mainLabel')}
        description={t('settings.agent.mainDesc')}
        value={maxIterations}
        onChange={onMaxIterationsChange}
        min={6}
      />

      <IterationStepper
        label={t('settings.agent.subLabel')}
        description={t('settings.agent.subDesc')}
        value={maxSubAgentIterations}
        onChange={onMaxSubAgentIterationsChange}
        min={6}
      />

      <IterationStepper
        label={t('settings.agent.accessibilityLabel')}
        description={t('settings.agent.accessibilityDesc')}
        value={maxAccessibilityIterations}
        onChange={onMaxAccessibilityIterationsChange}
        min={6}
      />
    </>
  );
}

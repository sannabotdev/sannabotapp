import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { t } from '../../../i18n';

interface HistorySectionProps {
  llmContextMaxMessages: number;
  onLlmContextMaxMessagesChange: (value: number) => void;
  conversationHistoryMaxMessages: number;
  onConversationHistoryMaxMessagesChange: (value: number) => void;
  onClearHistory?: () => void;
}

function HistoryStepper({
  label,
  description,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}): React.JSX.Element {
  return (
    <View
      className="px-4 py-3 border-b border-surface-tertiary"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
      <View className="flex-row items-center justify-between">
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text className="text-label-primary text-[15px] font-medium">{label}</Text>
          <Text className="text-label-secondary text-[12px] mt-0.5">{description}</Text>
        </View>

        <View className="flex-row items-center gap-1">
          <TouchableOpacity
            onPress={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="w-8 h-8 rounded-full bg-surface-tertiary items-center justify-center"
            activeOpacity={0.7}>
            <Text className="text-label-primary text-lg font-bold" style={{ lineHeight: 22 }}>
              −
            </Text>
          </TouchableOpacity>

          <Text
            className="text-label-primary text-base font-semibold text-center"
            style={{ width: 40 }}>
            {value}
          </Text>

          <TouchableOpacity
            onPress={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="w-8 h-8 rounded-full bg-surface-tertiary items-center justify-center"
            activeOpacity={0.7}>
            <Text className="text-label-primary text-lg font-bold" style={{ lineHeight: 22 }}>
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function HistorySection({
  llmContextMaxMessages,
  onLlmContextMaxMessagesChange,
  conversationHistoryMaxMessages,
  onConversationHistoryMaxMessagesChange,
  onClearHistory,
}: HistorySectionProps): React.JSX.Element {
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
        className="px-4 py-2 border-b border-surface-tertiary"
        style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
        <Text className="text-label-secondary text-[12px]">
          {t('settings.history.description')}
        </Text>
      </View>

      <HistoryStepper
        label={t('settings.history.llmContextLabel')}
        description={t('settings.history.llmContextDesc')}
        value={llmContextMaxMessages}
        onChange={onLlmContextMaxMessagesChange}
        min={10}
        max={200}
      />

      <HistoryStepper
        label={t('settings.history.conversationHistoryLabel')}
        description={t('settings.history.conversationHistoryDesc')}
        value={conversationHistoryMaxMessages}
        onChange={onConversationHistoryMaxMessagesChange}
        min={50}
        max={200}
      />

      {onClearHistory && (
        <View className="p-4">
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

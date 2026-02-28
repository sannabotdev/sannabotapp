import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { t } from '../../../i18n';

interface SoulSectionProps {
  soulText: string;
  onSoulTextChange: (value: string) => void;
  onDictateSoul: () => Promise<string>;
  onClearSoul: () => void;
  personalMemoryText: string;
  onPersonalMemoryTextChange: (value: string) => void;
  onClearPersonalMemory: () => void;
}

export function SoulSection({
  soulText,
  onSoulTextChange,
  onDictateSoul,
  onClearSoul,
  personalMemoryText,
  onPersonalMemoryTextChange,
  onClearPersonalMemory,
}: SoulSectionProps): React.JSX.Element {
  const [dictating, setDictating] = useState(false);
  const micScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (dictating) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(micScaleAnim, {
            toValue: 1.12,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micScaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }

    Animated.timing(micScaleAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [dictating, micScaleAnim]);

  const handleDictate = async () => {
    setDictating(true);
    try {
      const transcript = (await onDictateSoul()).trim();
      if (!transcript) return;
      const next = soulText.trim().length > 0 ? `${soulText}\n${transcript}` : transcript;
      onSoulTextChange(next);
    } finally {
      setDictating(false);
    }
  };

  const handleClear = () => {
    if (!soulText.trim()) {
      onClearSoul();
      return;
    }
    Alert.alert(
      t('settings.soul.clear'),
      t('settings.soul.clearConfirm'),
      [
        { text: t('settings.clearHistory.confirm.cancel'), style: 'cancel' },
        { text: t('settings.clearHistory.confirm.confirm'), style: 'destructive', onPress: onClearSoul },
      ],
    );
  };

  const handleClearMemory = () => {
    if (!personalMemoryText.trim()) {
      onClearPersonalMemory();
      return;
    }
    Alert.alert(
      t('settings.persona.memory.clear'),
      t('settings.persona.memory.clearConfirm'),
      [
        { text: t('settings.clearHistory.confirm.cancel'), style: 'cancel' },
        { text: t('settings.clearHistory.confirm.confirm'), style: 'destructive', onPress: onClearPersonalMemory },
      ],
    );
  };

  return (
    <View className="px-4 py-3 gap-3">
      <Text className="text-label-secondary text-xs leading-5">
        {t('settings.soul.description')}
      </Text>

      <TextInput
        className="bg-surface-tertiary text-label-primary rounded-xl px-3 py-3 text-sm"
        multiline
        value={soulText}
        onChangeText={onSoulTextChange}
        placeholder={t('settings.soul.placeholder')}
        placeholderTextColor="#8E8E93"
        textAlignVertical="top"
        style={{ minHeight: 160 }}
      />

      <View className="flex-row justify-end gap-2">
        <Animated.View style={{ transform: [{ scale: micScaleAnim }] }}>
          <TouchableOpacity
            className={`${dictating ? 'bg-accent-red' : 'bg-accent'} rounded-full w-10 h-10 items-center justify-center`}
            onPress={handleDictate}
            activeOpacity={0.75}
            accessibilityLabel={t('settings.soul.dictate')}>
            <Text className="text-white text-lg">{dictating ? '⏺️' : '🎤'}</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          className="bg-surface-tertiary rounded-full w-10 h-10 items-center justify-center"
          onPress={handleClear}
          activeOpacity={0.75}
          accessibilityLabel={t('settings.soul.clear')}>
          <Text className="text-label-primary text-base">🗑️</Text>
        </TouchableOpacity>
      </View>

      <View className="pt-1">
        <Text className="text-label-secondary text-xs leading-5 mb-2">
          {t('settings.persona.memory.description')}
        </Text>
        <TextInput
          className="bg-surface-tertiary text-label-primary rounded-xl px-3 py-3 text-sm"
          multiline
          value={personalMemoryText}
          onChangeText={onPersonalMemoryTextChange}
          placeholder={t('settings.persona.memory.placeholder')}
          placeholderTextColor="#8E8E93"
          textAlignVertical="top"
          style={{ minHeight: 140 }}
        />
        <View className="flex-row justify-end mt-2">
          <TouchableOpacity
            className="bg-surface-tertiary rounded-full w-10 h-10 items-center justify-center"
            onPress={handleClearMemory}
            activeOpacity={0.75}
            accessibilityLabel={t('settings.persona.memory.clear')}>
            <Text className="text-label-primary text-base">🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

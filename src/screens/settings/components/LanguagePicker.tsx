import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SettingRow } from './SettingRow';
import { t } from '../../../i18n';

interface LanguagePickerProps {
  value: 'system' | string;
  onChange: (language: 'system' | string) => void;
}

const LANGUAGES = [
  { value: 'system', label: () => t('settings.language.system') },
  { value: 'de-AT', label: () => 'Deutsch (de-AT)' },
  { value: 'de-DE', label: () => 'Deutsch (de-DE)' },
  { value: 'en-US', label: () => 'English (en-US)' },
  { value: 'en-GB', label: () => 'English (en-GB)' },
  { value: 'fr-FR', label: () => 'Français (fr-FR)' },
  { value: 'it-IT', label: () => 'Italiano (it-IT)' },
  { value: 'es-ES', label: () => 'Español (es-ES)' },
];

export function LanguagePicker({
  value,
  onChange,
}: LanguagePickerProps): React.JSX.Element {
  const [pickerVisible, setPickerVisible] = useState(false);

  const selectedEntry = LANGUAGES.find(l => l.value === value);
  const selectedLabel = selectedEntry ? selectedEntry.label() : value;

  return (
    <>
      <SettingRow
        label={t('settings.language.label')}
        description={t('settings.language.description')}>
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          className="bg-surface-tertiary rounded-lg px-3 py-2 min-w-[140px]">
          <Text className="text-label-primary text-sm text-right">{selectedLabel}</Text>
        </TouchableOpacity>
      </SettingRow>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}>
          <View className="bg-surface-elevated rounded-xl w-[80%] max-w-[400px] overflow-hidden">
            <View className="p-4 border-b border-surface-tertiary">
              <Text className="text-label-primary text-lg font-bold">
                {t('settings.language.pickTitle')}
              </Text>
            </View>
            <ScrollView className="max-h-[400px]">
              {LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang.value}
                  className="p-4 border-b border-surface-tertiary"
                  onPress={() => {
                    onChange(lang.value as 'system' | string);
                    setPickerVisible(false);
                  }}>
                  <Text
                    className={`text-[15px] ${
                      value === lang.value
                        ? 'text-accent font-semibold'
                        : 'text-label-primary'
                    }`}>
                    {lang.label()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

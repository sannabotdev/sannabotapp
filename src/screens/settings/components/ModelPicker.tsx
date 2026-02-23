import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SettingRow } from './SettingRow';
import { t } from '../../../i18n';

interface ModelPickerProps {
  label: string;
  apiKey: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
  fetchModels: (apiKey: string) => Promise<string[]>;
  defaultModel: string;
}

export function ModelPicker({
  label,
  apiKey,
  selectedModel,
  onModelChange,
  fetchModels,
  defaultModel,
}: ModelPickerProps): React.JSX.Element {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setModels([]);
      return;
    }
    setLoading(true);
    fetchModels(apiKey)
      .then(fetchedModels => {
        setModels(fetchedModels);
      })
      .catch(() => {
        setModels([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiKey, fetchModels]);

  const displayModel = selectedModel || defaultModel;

  return (
    <>
      <SettingRow label={label}>
          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
          className="bg-surface-tertiary rounded-lg px-3 py-2 min-w-[140px]"
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#8E8E93" />
          ) : (
            <Text className="text-label-primary text-sm text-right" numberOfLines={1}>
              {displayModel}
            </Text>
          )}
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
                  <Text className="text-label-primary text-lg font-bold">{label}</Text>
                </View>
            {loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color="#007AFF" />
                <Text className="text-label-secondary text-sm mt-2">
                  {t('settings.provider.loadingModels')}
                </Text>
              </View>
            ) : (
                <ScrollView className="max-h-[400px]">
                {models.map(model => (
                    <TouchableOpacity
                      key={model}
                      className="p-4 border-b border-surface-tertiary"
                      onPress={() => {
                        onModelChange(model);
                        setPickerVisible(false);
                      }}>
                      <Text
                        className={`text-[15px] ${
                        selectedModel === model
                          ? 'text-accent font-semibold'
                          : 'text-label-primary'
                      }`}>
                        {model}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
            )}
              </View>
            </TouchableOpacity>
          </Modal>
        </>
  );
}

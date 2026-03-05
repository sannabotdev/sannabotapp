import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SettingRow } from './SettingRow';
import { t } from '../../../i18n';

interface ModelPickerProps {
  label: string;
  apiKey: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
  fetchModels:
    | ((apiKey: string) => Promise<string[]>)
    | ((apiKey: string, baseUrl: string) => Promise<string[]>);
  defaultModel: string;
  allowManualInput?: boolean;
  baseUrl?: string;
}

export function ModelPicker({
  label,
  apiKey,
  selectedModel,
  onModelChange,
  fetchModels,
  defaultModel,
  allowManualInput = false,
  baseUrl,
}: ModelPickerProps): React.JSX.Element {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    if (!apiKey) {
      setModels([]);
      return;
    }
    setLoading(true);

    const doFetch = async () => {
      try {
        let fetchedModels: string[];
        if (baseUrl && fetchModels.length === 2) {
          fetchedModels = await (
            fetchModels as (
              apiKey: string,
              baseUrl: string,
            ) => Promise<string[]>
          )(apiKey, baseUrl);
        } else {
          fetchedModels = await (
            fetchModels as (apiKey: string) => Promise<string[]>
          )(apiKey);
        }
        setModels(fetchedModels);
      } catch {
        setModels([]);
      } finally {
        setLoading(false);
      }
    };

    doFetch();
  }, [apiKey, fetchModels, baseUrl]);

  useEffect(() => {
    setManualInput(selectedModel || defaultModel);
  }, [selectedModel, defaultModel]);

  const displayModel = selectedModel || defaultModel;

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onModelChange(manualInput.trim());
      setPickerVisible(false);
    }
  };

  return (
    <>
      <SettingRow label={label}>
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          className="bg-surface-tertiary rounded-lg px-3 py-2 min-w-[140px]"
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#8E8E93" />
          ) : (
            <Text
              className="text-label-primary text-sm text-right"
              numberOfLines={1}
            >
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
              <TouchableOpacity
                className="bg-surface-elevated rounded-xl w-[80%] max-w-[400px] overflow-hidden"
                activeOpacity={1}
                onPress={() => {}}>
                <View className="p-4 border-b border-surface-tertiary flex-row items-center justify-between">
                  <Text className="text-label-primary text-lg font-bold flex-1">{label}</Text>
                  <TouchableOpacity onPress={() => setPickerVisible(false)} className="p-1">
                    <Text className="text-accent text-sm font-medium">{t('evidence.close')}</Text>
                  </TouchableOpacity>
                </View>
            {loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color="#007AFF" />
                <Text className="text-label-secondary text-sm mt-2">
                  {t('settings.provider.loadingModels')}
                </Text>
              </View>
            ) : (
              <>
                {models.length > 0 && (
                  <ScrollView className="max-h-[300px]">
                    {models.map(model => (
                      <TouchableOpacity
                        key={model}
                        className="p-4 border-b border-surface-tertiary"
                        onPress={() => {
                          onModelChange(model);
                          setPickerVisible(false);
                        }}
                      >
                        <Text
                          className={`text-[15px] ${
                            selectedModel === model
                              ? 'text-accent font-semibold'
                              : 'text-label-primary'
                          }`}
                        >
                          {model}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {allowManualInput && (
                  <View className="p-4 border-t border-surface-tertiary">
                    <Text className="text-label-secondary text-sm mb-2">
                      {t('settings.provider.manualModelInput')}
                    </Text>
                    <TextInput
                      className="bg-surface-tertiary text-label-primary rounded-lg px-3 py-2 mb-2"
                      value={manualInput}
                      onChangeText={setManualInput}
                      placeholder="model-name"
                      placeholderTextColor="#8E8E93"
                    />
                    <TouchableOpacity
                      className="bg-accent rounded-lg px-4 py-2"
                      onPress={handleManualSubmit}
                      disabled={!manualInput.trim()}
                    >
                      <Text className="text-label-primary text-sm font-medium text-center">
                        OK
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </>
  );
}

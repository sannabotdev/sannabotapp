import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { ModelPicker } from '../components/ModelPicker';
import { ProviderToggle } from '../components/ProviderToggle';
import {
  fetchClaudeModels,
  fetchCustomModels,
  fetchOpenAIModels,
} from '../../../llm/model-list';
import { t } from '../../../i18n';

interface ProviderSectionProps {
  selectedProvider: 'claude' | 'openai' | 'custom';
  onProviderChange: (provider: 'claude' | 'openai' | 'custom') => void;
  claudeApiKey: string;
  onClaudeApiKeyChange: (key: string) => void;
  openAIApiKey: string;
  onOpenAIApiKeyChange: (key: string) => void;
  selectedOpenAIModel: string;
  onOpenAIModelChange: (model: string) => void;
  selectedClaudeModel: string;
  onClaudeModelChange: (model: string) => void;
  customApiKey: string;
  onCustomApiKeyChange: (key: string) => void;
  customModelUrl: string;
  onCustomModelUrlChange: (url: string) => void;
  customModelName: string;
  onCustomModelNameChange: (name: string) => void;
  onTestCustomConnection?: () => void;
}

export function ProviderSection({
  selectedProvider,
  onProviderChange,
  claudeApiKey,
  onClaudeApiKeyChange,
  openAIApiKey,
  onOpenAIApiKeyChange,
  selectedOpenAIModel,
  onOpenAIModelChange,
  selectedClaudeModel,
  onClaudeModelChange,
  customApiKey,
  onCustomApiKeyChange,
  customModelUrl,
  onCustomModelUrlChange,
  customModelName,
  onCustomModelNameChange,
  onTestCustomConnection,
}: ProviderSectionProps): React.JSX.Element {
  return (
    <>
      <ProviderToggle selected={selectedProvider} onChange={onProviderChange} />
      <ApiKeyInput
        label="Claude API Key (Anthropic)"
        value={claudeApiKey}
        onChange={onClaudeApiKeyChange}
        placeholder="sk-ant-..."
        visible={selectedProvider === 'claude'}
      />
      {selectedProvider === 'claude' && (
        <ModelPicker
          label={t('settings.provider.claudeModel')}
          apiKey={claudeApiKey}
          selectedModel={selectedClaudeModel}
          onModelChange={onClaudeModelChange}
          fetchModels={fetchClaudeModels}
          defaultModel="claude-3-5-sonnet-20241022"
        />
      )}
      <ApiKeyInput
        label="OpenAI API Key"
        value={openAIApiKey}
        onChange={onOpenAIApiKeyChange}
        placeholder="sk-..."
        visible={selectedProvider === 'openai'}
      />
      {selectedProvider === 'openai' && (
        <ModelPicker
          label={t('settings.provider.openaiModel')}
          apiKey={openAIApiKey}
          selectedModel={selectedOpenAIModel}
          onModelChange={onOpenAIModelChange}
          fetchModels={fetchOpenAIModels}
          defaultModel="gpt-5.2"
        />
      )}
      {selectedProvider === 'custom' && (
        <>
          <ApiKeyInput
            label={t('settings.provider.customApiKey')}
            value={customApiKey}
            onChange={onCustomApiKeyChange}
            placeholder="sk-..."
            visible={selectedProvider === 'custom'}
          />
          <ApiKeyInput
            label={t('settings.provider.customBaseUrl')}
            value={customModelUrl}
            onChange={onCustomModelUrlChange}
            placeholder="https://your-server.com/v1"
            visible={selectedProvider === 'custom'}
            secureTextEntry={false}
          />
          <ModelPicker
            label={t('settings.provider.customModel')}
            apiKey={customApiKey}
            selectedModel={customModelName}
            onModelChange={onCustomModelNameChange}
            fetchModels={fetchCustomModels}
            defaultModel="custom-model"
            allowManualInput
            baseUrl={customModelUrl}
          />
          <View className="mt-2">
            <CustomConnectionTest
              onTest={onTestCustomConnection}
              apiKey={customApiKey}
              url={customModelUrl}
            />
          </View>
        </>
      )}
    </>
  );
}

interface CustomConnectionTestProps {
  onTest?: () => void;
  apiKey: string;
  url: string;
}

function CustomConnectionTest({
  onTest,
  apiKey,
  url,
}: CustomConnectionTestProps): React.JSX.Element | null {
  const [testing, setTesting] = useState(false);

  const canTest =
    apiKey.trim() !== '' && url.trim() !== '' && onTest !== undefined;

  const handleTest = async () => {
    if (!canTest || !onTest) return;
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  // Don't render if callback is not provided
  if (onTest === undefined) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handleTest}
      disabled={!canTest || testing}
      className={`rounded-lg px-4 py-3 mt-2 ${
        canTest && !testing ? 'bg-accent' : 'bg-surface-tertiary opacity-50'
      }`}
    >
      {testing ? (
        <View className="flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color="#fff" />
          <Text className="text-label-primary text-sm font-medium">
            {t('settings.provider.testingConnection')}
          </Text>
        </View>
      ) : (
        <Text className="text-label-primary text-sm font-medium text-center">
          {t('settings.provider.testConnection')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

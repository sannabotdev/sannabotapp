import React from 'react';
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
        </>
      )}
    </>
  );
}

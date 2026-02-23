import React from 'react';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { ModelPicker } from '../components/ModelPicker';
import { ProviderToggle } from '../components/ProviderToggle';
import { fetchClaudeModels, fetchOpenAIModels } from '../../../llm/model-list';
import { t } from '../../../i18n';

interface ProviderSectionProps {
  selectedProvider: 'claude' | 'openai';
  onProviderChange: (provider: 'claude' | 'openai') => void;
  claudeApiKey: string;
  onClaudeApiKeyChange: (key: string) => void;
  openAIApiKey: string;
  onOpenAIApiKeyChange: (key: string) => void;
  selectedOpenAIModel: string;
  onOpenAIModelChange: (model: string) => void;
  selectedClaudeModel: string;
  onClaudeModelChange: (model: string) => void;
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
          defaultModel="gpt-4o"
        />
      )}
    </>
  );
}

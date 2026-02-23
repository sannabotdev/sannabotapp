import React from 'react';
import { Switch } from 'react-native';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { SettingRow } from '../components/SettingRow';
import { t } from '../../../i18n';

interface WakeWordSectionProps {
  wakeWordEnabled: boolean;
  onWakeWordToggle: (enabled: boolean) => void;
  wakeWordKey: string;
  onWakeWordKeyChange: (key: string) => void;
}

export function WakeWordSection({
  wakeWordEnabled,
  onWakeWordToggle,
  wakeWordKey,
  onWakeWordKeyChange,
}: WakeWordSectionProps): React.JSX.Element {
  return (
    <>
      <SettingRow
        label={t('settings.wakeWord.label')}
        description={t('settings.wakeWord.description')}>
        <Switch
          value={wakeWordEnabled}
          onValueChange={onWakeWordToggle}
          trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
          thumbColor="#FFFFFF"
        />
      </SettingRow>
      {wakeWordEnabled && (
        <ApiKeyInput
          label={t('settings.wakeWord.keyLabel')}
          value={wakeWordKey}
          onChange={onWakeWordKeyChange}
          placeholder="Picovoice AccessKey..."
          visible={true}
        />
      )}
    </>
  );
}

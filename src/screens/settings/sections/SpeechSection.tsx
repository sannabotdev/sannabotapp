import React from 'react';
import { LanguagePicker } from '../components/LanguagePicker';
import { ModeSelector } from '../components/ModeSelector';

interface SpeechSectionProps {
  sttLanguage: 'system' | string;
  onSttLanguageChange: (language: 'system' | string) => void;
  sttMode: 'auto' | 'offline' | 'online';
  onSttModeChange: (mode: 'auto' | 'offline' | 'online') => void;
  appLanguage: 'system' | string;
  onAppLanguageChange: (lang: 'system' | string) => void;
}

export function SpeechSection({
  sttLanguage,
  onSttLanguageChange,
  sttMode,
  onSttModeChange,
  appLanguage,
  onAppLanguageChange,
}: SpeechSectionProps): React.JSX.Element {
  return (
    <>
      <LanguagePicker
        value={appLanguage}
        onChange={lang => {
          onAppLanguageChange(lang);
          // Keep STT language in sync with app language
          onSttLanguageChange(lang);
        }}
      />
      <ModeSelector value={sttMode} onChange={onSttModeChange} />
    </>
  );
}

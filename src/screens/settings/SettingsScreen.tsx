/**
 * SettingsScreen – API Keys, Wake Word, Skills credential management
 */
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CredentialManager } from '../../permissions/credential-manager';
import type { SkillInfo } from '../../agent/skill-loader';
import type { TTSService } from '../../audio/tts-service';
import { CollapsibleSection } from './components/CollapsibleSection';
import { EvidenceModal } from './components/EvidenceModal';
import { useSkillCredentials } from './hooks/useSkillCredentials';
import { useSkillTesting } from './hooks/useSkillTesting';
import { AboutSection } from './sections/AboutSection';
import { AgentSection } from './sections/AgentSection';
import { HistorySection } from './sections/HistorySection';
import { ProviderSection } from './sections/ProviderSection';
import { ServicesSection } from './sections/ServicesSection';
import { SkillsSection } from './sections/SkillsSection';
import { SoulSection } from './sections/SoulSection';
import { SpeechSection } from './sections/SpeechSection';
import { WakeWordSection } from './sections/WakeWordSection';
import { t } from '../../i18n';

type SectionId = 'provider' | 'wakeWord' | 'services' | 'speech' | 'soul' | 'skills' | 'agent' | 'history' | 'about';

interface SettingsScreenProps {
  onBack: () => void;
  credentialManager: CredentialManager;
  allSkills: SkillInfo[];
  enabledSkillNames: string[];
  skillAvailability: Record<string, boolean>;
  onToggleSkill: (skillName: string, enabled: boolean) => void;
  claudeApiKey: string;
  onClaudeApiKeyChange: (key: string) => void;
  openAIApiKey: string;
  onOpenAIApiKeyChange: (key: string) => void;
  selectedProvider: 'claude' | 'openai';
  onProviderChange: (provider: 'claude' | 'openai') => void;
  selectedOpenAIModel: string;
  onOpenAIModelChange: (model: string) => void;
  selectedClaudeModel: string;
  onClaudeModelChange: (model: string) => void;
  wakeWordEnabled: boolean;
  onWakeWordToggle: (enabled: boolean) => void;
  wakeWordKey: string;
  onWakeWordKeyChange: (key: string) => void;
  sttLanguage: 'system' | string;
  onSttLanguageChange: (language: 'system' | string) => void;
  sttMode: 'auto' | 'offline' | 'online';
  onSttModeChange: (mode: 'auto' | 'offline' | 'online') => void;
  appLanguage: 'system' | string;
  onAppLanguageChange: (lang: 'system' | string) => void;
  googleWebClientId: string;
  onGoogleWebClientIdChange: (id: string) => void;
  spotifyClientId: string;
  onSpotifyClientIdChange: (id: string) => void;
  slackClientId: string;
  onSlackClientIdChange: (id: string) => void;
  googleMapsApiKey: string;
  onGoogleMapsApiKeyChange: (key: string) => void;
  onTestSkill?: (skillName: string) => Promise<{
    success: boolean;
    message: string;
    error?: string;
    evidence?: {
      toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
      toolResults: Array<{ toolName: string; result: string; isError: boolean }>;
      finalResponse?: string;
      iterations: number;
    };
  }>;
  ttsService?: TTSService;
  onAddSkill?: (content: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteSkill?: (skillName: string) => Promise<void>;
  dynamicSkillNames?: string[];
  onClearHistory?: () => void;
  maxIterations: number;
  onMaxIterationsChange: (value: number) => void;
  maxSubAgentIterations: number;
  onMaxSubAgentIterationsChange: (value: number) => void;
  maxAccessibilityIterations: number;
  onMaxAccessibilityIterationsChange: (value: number) => void;
  llmContextMaxMessages: number;
  onLlmContextMaxMessagesChange: (value: number) => void;
  conversationHistoryMaxMessages: number;
  onConversationHistoryMaxMessagesChange: (value: number) => void;
  soulText: string;
  onSoulTextChange: (value: string) => void;
  onDictateSoul: () => Promise<string>;
  onClearSoul: () => void;
  personalMemoryText: string;
  onPersonalMemoryTextChange: (value: string) => void;
  onClearPersonalMemory: () => void;
}

export function SettingsScreen({
  onBack,
  credentialManager,
  allSkills,
  enabledSkillNames,
  skillAvailability,
  onToggleSkill,
  claudeApiKey,
  onClaudeApiKeyChange,
  openAIApiKey,
  onOpenAIApiKeyChange,
  selectedProvider,
  onProviderChange,
  selectedOpenAIModel,
  onOpenAIModelChange,
  selectedClaudeModel,
  onClaudeModelChange,
  wakeWordEnabled,
  onWakeWordToggle,
  wakeWordKey,
  onWakeWordKeyChange,
  sttLanguage,
  onSttLanguageChange,
  sttMode,
  onSttModeChange,
  appLanguage,
  onAppLanguageChange,
  googleWebClientId,
  onGoogleWebClientIdChange,
  spotifyClientId,
  onSpotifyClientIdChange,
  slackClientId,
  onSlackClientIdChange,
  googleMapsApiKey,
  onGoogleMapsApiKeyChange,
  onTestSkill,
  ttsService,
  onAddSkill,
  onDeleteSkill,
  dynamicSkillNames,
  onClearHistory,
  maxIterations,
  onMaxIterationsChange,
  maxSubAgentIterations,
  onMaxSubAgentIterationsChange,
  maxAccessibilityIterations,
  onMaxAccessibilityIterationsChange,
  llmContextMaxMessages,
  onLlmContextMaxMessagesChange,
  conversationHistoryMaxMessages,
  onConversationHistoryMaxMessagesChange,
  soulText,
  onSoulTextChange,
  onDictateSoul,
  onClearSoul,
  personalMemoryText,
  onPersonalMemoryTextChange,
  onClearPersonalMemory,
}: SettingsScreenProps): React.JSX.Element {
  const { skillCredentialStatus, checkSkillCredentials } = useSkillCredentials(
    allSkills,
    credentialManager,
  );

  const {
    testingSkill,
    testResults,
    evidenceModalVisible,
    evidenceModalContent,
    handleTestSkill,
    showEvidencePopup,
    handleCloseEvidenceModal,
  } = useSkillTesting(onTestSkill);

  // Accordion: Only one section open at a time
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const handleSectionToggle = (sectionId: SectionId) => {
    setOpenSection(prev => (prev === sectionId ? null : sectionId));
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-surface-elevated gap-3">
        <TouchableOpacity onPress={onBack} className="p-1">
          <Text className="text-accent text-base">{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text className="text-label-primary text-lg font-bold">{t('settings.title')}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 48 }}>
        {/* Language */}
        <CollapsibleSection
          title={t('settings.section.language')}
          expanded={openSection === 'speech'}
          onToggle={() => handleSectionToggle('speech')}>
          <SpeechSection
            sttLanguage={sttLanguage}
            onSttLanguageChange={onSttLanguageChange}
            sttMode={sttMode}
            onSttModeChange={onSttModeChange}
            appLanguage={appLanguage}
            onAppLanguageChange={onAppLanguageChange}
          />
        </CollapsibleSection>

        {/* Wake Word */}
        <CollapsibleSection
          title={t('settings.section.wakeWord')}
          expanded={openSection === 'wakeWord'}
          onToggle={() => handleSectionToggle('wakeWord')}>
          <WakeWordSection
            wakeWordEnabled={wakeWordEnabled}
            onWakeWordToggle={onWakeWordToggle}
            wakeWordKey={wakeWordKey}
            onWakeWordKeyChange={onWakeWordKeyChange}
          />
        </CollapsibleSection>

        {/* Soul */}
        <CollapsibleSection
          title={t('settings.section.soul')}
          expanded={openSection === 'soul'}
          onToggle={() => handleSectionToggle('soul')}>
          <SoulSection
            soulText={soulText}
            onSoulTextChange={onSoulTextChange}
            onDictateSoul={onDictateSoul}
            onClearSoul={onClearSoul}
            personalMemoryText={personalMemoryText}
            onPersonalMemoryTextChange={onPersonalMemoryTextChange}
            onClearPersonalMemory={onClearPersonalMemory}
          />
        </CollapsibleSection>

        {/* Skills */}
        <CollapsibleSection
          title={t('settings.section.skills')}
          expanded={openSection === 'skills'}
          onToggle={() => handleSectionToggle('skills')}>
          <SkillsSection
            allSkills={allSkills}
            enabledSkillNames={enabledSkillNames}
            skillAvailability={skillAvailability}
            onToggleSkill={onToggleSkill}
            credentialManager={credentialManager}
            skillCredentialStatus={skillCredentialStatus}
            checkSkillCredentials={checkSkillCredentials}
            testingSkill={testingSkill}
            testResults={testResults}
            handleTestSkill={handleTestSkill}
            showEvidencePopup={showEvidencePopup}
            onTestSkill={onTestSkill}
            onAddSkill={onAddSkill}
            onDeleteSkill={onDeleteSkill}
            dynamicSkillNames={dynamicSkillNames}
          />
        </CollapsibleSection>

        {/* Services & OAuth */}
        <CollapsibleSection
          title={t('settings.section.services')}
          expanded={openSection === 'services'}
          onToggle={() => handleSectionToggle('services')}>
          <ServicesSection
            googleWebClientId={googleWebClientId}
            onGoogleWebClientIdChange={onGoogleWebClientIdChange}
            spotifyClientId={spotifyClientId}
            onSpotifyClientIdChange={onSpotifyClientIdChange}
            wakeWordKey={wakeWordKey}
            onWakeWordKeyChange={onWakeWordKeyChange}
            slackClientId={slackClientId}
            onSlackClientIdChange={onSlackClientIdChange}
            googleMapsApiKey={googleMapsApiKey}
            onGoogleMapsApiKeyChange={onGoogleMapsApiKeyChange}
          />
        </CollapsibleSection>

        {/* LLM Provider */}
        <CollapsibleSection
          title={t('settings.section.provider')}
          expanded={openSection === 'provider'}
          onToggle={() => handleSectionToggle('provider')}>
          <ProviderSection
            selectedProvider={selectedProvider}
            onProviderChange={onProviderChange}
            claudeApiKey={claudeApiKey}
            onClaudeApiKeyChange={onClaudeApiKeyChange}
            openAIApiKey={openAIApiKey}
            onOpenAIApiKeyChange={onOpenAIApiKeyChange}
            selectedOpenAIModel={selectedOpenAIModel}
            onOpenAIModelChange={onOpenAIModelChange}
            selectedClaudeModel={selectedClaudeModel}
            onClaudeModelChange={onClaudeModelChange}
          />
        </CollapsibleSection>

        {/* Agent Iterations */}
        <CollapsibleSection
          title={t('settings.section.agent')}
          expanded={openSection === 'agent'}
          onToggle={() => handleSectionToggle('agent')}>
          <AgentSection
            maxIterations={maxIterations}
            onMaxIterationsChange={onMaxIterationsChange}
            maxSubAgentIterations={maxSubAgentIterations}
            onMaxSubAgentIterationsChange={onMaxSubAgentIterationsChange}
            maxAccessibilityIterations={maxAccessibilityIterations}
            onMaxAccessibilityIterationsChange={onMaxAccessibilityIterationsChange}
          />
        </CollapsibleSection>

        {/* History */}
        <CollapsibleSection
          title={t('settings.section.history')}
          expanded={openSection === 'history'}
          onToggle={() => handleSectionToggle('history')}>
          <HistorySection
            llmContextMaxMessages={llmContextMaxMessages}
            onLlmContextMaxMessagesChange={onLlmContextMaxMessagesChange}
            conversationHistoryMaxMessages={conversationHistoryMaxMessages}
            onConversationHistoryMaxMessagesChange={onConversationHistoryMaxMessagesChange}
            onClearHistory={onClearHistory}
          />
        </CollapsibleSection>

        {/* About */}
        <CollapsibleSection
          title={t('settings.section.about')}
          expanded={openSection === 'about'}
          onToggle={() => handleSectionToggle('about')}>
          <AboutSection />
        </CollapsibleSection>
      </ScrollView>

      {/* Evidence Modal */}
      {evidenceModalContent && (
        <EvidenceModal
          visible={evidenceModalVisible}
          title={evidenceModalContent.title}
          text={evidenceModalContent.text}
          onClose={handleCloseEvidenceModal}
          ttsService={ttsService}
        />
      )}
    </SafeAreaView>
  );
}

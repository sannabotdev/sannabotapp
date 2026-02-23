import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { TTSService } from '../../../audio/tts-service';
import { t } from '../../../i18n';

interface EvidenceModalProps {
  visible: boolean;
  title: string;
  text: string;
  onClose: () => void;
  ttsService?: TTSService;
}

export function EvidenceModal({
  visible,
  title,
  text,
  onClose,
}: EvidenceModalProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-center items-center"
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity
          className="bg-surface-elevated rounded-xl w-[90%] max-w-[500px] overflow-hidden"
          activeOpacity={1}
          onPress={() => {}}>
          <View className="p-4 border-b border-surface-tertiary">
            <Text className="text-label-primary text-lg font-bold">{title || t('evidence.noDetails')}</Text>
          </View>
          <ScrollView className="max-h-[500px] p-4">
            <Text className="text-label-secondary text-sm font-mono">
              {text || t('evidence.noDetails')}
              </Text>
          </ScrollView>
          <View className="p-3 border-t border-surface-tertiary">
          <TouchableOpacity
              className="py-2 items-center"
            onPress={onClose}>
              <Text className="text-accent font-medium">{t('evidence.close')}</Text>
          </TouchableOpacity>
        </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

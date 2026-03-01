/**
 * AvatarMenu – Slide-in side-drawer that opens when the user taps the avatar.
 *
 * Contains:
 *   - Settings button (navigates to SettingsScreen)
 *   - Debug button (opens DebugPanel)
 *   - Dark Mode toggle switch
 */
import React from 'react';
import {
  Modal,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { t } from '../i18n';
import { SannaAvatar } from './SannaAvatar';

export interface AvatarMenuProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  onSettingsPress: () => void;
  onDebugPress: () => void;
  onListsPress: () => void;
  onSchedulesPress: () => void;
  onNotificationListenersPress: () => void;
  debugLogEnabled: boolean;
}

export function AvatarMenu({
  visible,
  onClose,
  isDark,
  onToggleDarkMode,
  onSettingsPress,
  onDebugPress,
  onListsPress,
  onSchedulesPress,
  onNotificationListenersPress,
  debugLogEnabled,
}: AvatarMenuProps): React.JSX.Element {
  const handleSettings = () => {
    onClose();
    // Small delay so the menu closes before navigating
    setTimeout(onSettingsPress, 150);
  };

  const handleDebug = () => {
    onClose();
    setTimeout(onDebugPress, 150);
  };

  const handleLists = () => {
    onClose();
    setTimeout(onListsPress, 150);
  };

  const handleSchedules = () => {
    onClose();
    setTimeout(onSchedulesPress, 150);
  };

  const handleNotificationListeners = () => {
    onClose();
    setTimeout(onNotificationListenersPress, 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Scrim – tap outside to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          {/* Prevent touches inside the panel from closing the menu */}
          <TouchableWithoutFeedback>
            <View
              className="absolute top-0 left-0 bottom-0 w-64 bg-surface"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 4, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 16,
              }}>

              {/* Header with Avatar */}
              <View className="pt-14 pb-6 px-5 bg-surface-elevated items-center gap-3 border-b border-surface-elevated">
                <SannaAvatar size={72} />
                <Text className="text-label-primary text-lg font-bold">Sanna</Text>
              </View>

              {/* Menu Items */}
              <View className="flex-1 py-2">

                {/* Listen */}
                <TouchableOpacity
                  onPress={handleLists}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-4 px-5 py-4 border-b border-surface-elevated">
                  <Text className="text-2xl">📋</Text>
                  <Text className="text-label-primary text-base font-medium">{t('menu.lists')}</Text>
                </TouchableOpacity>

                {/* Zeitpläne */}
                <TouchableOpacity
                  onPress={handleSchedules}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-4 px-5 py-4 border-b border-surface-elevated">
                  <Text className="text-2xl">⏰</Text>
                  <Text className="text-label-primary text-base font-medium">{t('menu.scheduler')}</Text>
                </TouchableOpacity>

                {/* Benachrichtigungs-Regeln */}
                <TouchableOpacity
                  onPress={handleNotificationListeners}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-4 px-5 py-4 border-b border-surface-elevated">
                  <Text className="text-2xl">🔔</Text>
                  <Text className="text-label-primary text-base font-medium">{t('menu.notificationListeners')}</Text>
                </TouchableOpacity>

                {/* Settings */}
                <TouchableOpacity
                  onPress={handleSettings}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-4 px-5 py-4 border-b border-surface-elevated">
                  <Text className="text-2xl">⚙️</Text>
                  <Text className="text-label-primary text-base font-medium">{t('menu.settings')}</Text>
                </TouchableOpacity>

                {/* Dark Mode Toggle */}
                <View className="flex-row items-center gap-4 px-5 py-4 border-b border-surface-elevated">
                  <Text className="text-2xl">{isDark ? '☀️' : '🌙'}</Text>
                  <Text className="text-label-primary text-base font-medium flex-1">
                    {isDark ? t('menu.darkMode.dark') : t('menu.darkMode.light')}
                  </Text>
                  <Switch
                    value={isDark}
                    onValueChange={onToggleDarkMode}
                    trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Debug - only show if enabled */}
                {debugLogEnabled && (
                  <TouchableOpacity
                    onPress={handleDebug}
                    activeOpacity={0.7}
                    className="flex-row items-center gap-4 px-5 py-4 border-b border-surface-elevated">
                    <Text className="text-2xl">🪲</Text>
                    <Text className="text-label-primary text-base font-medium">{t('menu.debug')}</Text>
                  </TouchableOpacity>
                )}

              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

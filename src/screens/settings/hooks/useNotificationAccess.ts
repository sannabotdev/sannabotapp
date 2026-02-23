import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getNotificationListenerModule } from '../../../native/NotificationListenerModule';
import { t } from '../../../i18n';

export function useNotificationAccess(enabledSkillNames: string[]) {
  const [notificationAccessGranted, setNotificationAccessGranted] = useState<boolean | null>(null);

  const checkNotificationAccess = useCallback(async () => {
    const module = getNotificationListenerModule();
    if (!module) {
      setNotificationAccessGranted(false);
      return;
    }
    try {
      const granted = await module.isNotificationAccessGranted();
      setNotificationAccessGranted(granted);
    } catch {
      setNotificationAccessGranted(false);
    }
  }, []);

  const handleOpenNotificationSettings = useCallback(async () => {
    const module = getNotificationListenerModule();
    if (!module) return;
    try {
      await module.openNotificationAccessSettings();
      // Re-check after a delay (user might have granted access)
      setTimeout(() => {
        checkNotificationAccess();
      }, 1000);
    } catch (err) {
      Alert.alert(t('alert.error'), t('notification.settingsError'));
    }
  }, [checkNotificationAccess]);

  useEffect(() => {
    if (enabledSkillNames.includes('notifications')) {
      checkNotificationAccess();
    }
  }, [enabledSkillNames, checkNotificationAccess]);

  return { notificationAccessGranted, handleOpenNotificationSettings };
}

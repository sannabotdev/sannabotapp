/**
 * HomeScreen – Main UI with text input/output + optional microphone
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PipelineState } from '../agent/conversation-pipeline';
import { DebugPanel } from './DebugPanel';
import { SannaAvatar } from '../components/SannaAvatar';
import { AvatarMenu } from '../components/AvatarMenu';
import { MarkdownText } from '../components/MarkdownText';
import KeepAwakeModule from '../native/KeepAwakeModule';
import { t } from '../i18n';

export interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface HomeScreenProps {
  onMicPress: () => void;
  onTextSubmit: (text: string) => void;
  pipelineState: PipelineState;
  drivingMode: boolean;
  onToggleDrivingMode: () => void;
  onSettingsPress: () => void;
  onListsPress: () => void;
  onSchedulesPress: () => void;
  onNotificationListenersPress: () => void;
  onJournalPress: () => void;
  messages: Message[];
  isDark: boolean;
  onToggleDarkMode: () => void;
  historyLoading?: boolean;
  /** BCP-47 language tag for time formatting (e.g. 'de-AT', 'en-US') */
  language: string;
  debugLogEnabled: boolean;
}

const STATE_COLORS: Record<PipelineState, string> = {
  idle: 'bg-accent-green',
  listening: 'bg-accent',
  processing: 'bg-accent-orange',
  speaking: 'bg-accent-purple',
  error: 'bg-accent-red',
};

const STATE_TEXT_COLORS: Record<PipelineState, string> = {
  idle: 'text-accent-green',
  listening: 'text-accent',
  processing: 'text-accent-orange',
  speaking: 'text-accent-purple',
  error: 'text-accent-red',
};

export function HomeScreen({
  onMicPress,
  onTextSubmit,
  pipelineState,
  drivingMode,
  onToggleDrivingMode,
  onSettingsPress,
  onListsPress,
  onSchedulesPress,
  onNotificationListenersPress,
  onJournalPress,
  messages,
  isDark,
  onToggleDarkMode,
  historyLoading,
  language,
  debugLogEnabled,
}: HomeScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const isBusy = pipelineState !== 'idle';
  const [debugVisible, setDebugVisible] = useState(false);
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);
  
  // Track previous message state to detect new messages
  const prevMessageCountRef = useRef(messages.length);
  const prevLastMessageRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);
  
  // Animation for large microphone button when listening
  const drivingMicScaleAnim = useRef(new Animated.Value(1)).current;

  // Scroll to end when new messages are added (by count or last message change)
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    
    // Get last message identifier (timestamp + text snippet) for comparison
    const lastMessage = messages.length > 0 
      ? `${messages[messages.length - 1].timestamp.getTime()}-${messages[messages.length - 1].text.slice(0, 50)}`
      : null;
    const prevLastMessage = prevLastMessageRef.current;
    
    // On initial mount or when history loading completes, scroll without animation
    if (isInitialMountRef.current || historyLoading) {
      isInitialMountRef.current = false;
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
      prevMessageCountRef.current = currentCount;
      prevLastMessageRef.current = lastMessage;
      return;
    }
    
    // Scroll if:
    // 1. New messages were added (count increased), OR
    // 2. Last message changed (new message appended, e.g. from drainPending/scheduler/notifications)
    const hasNewMessages = currentCount > prevCount;
    const lastMessageChanged = lastMessage !== null && lastMessage !== prevLastMessage;
    
    if (hasNewMessages || lastMessageChanged) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    }
    
    prevMessageCountRef.current = currentCount;
    prevLastMessageRef.current = lastMessage;
  }, [messages, historyLoading]);

  // Scroll to bottom when switching modes
  useEffect(() => {
    // Small delay to ensure the layout has updated
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [drivingMode]);

  // Keep screen on while in driving mode so the user never has to unlock
  useEffect(() => {
    if (drivingMode) {
      KeepAwakeModule.activate();
    } else {
      KeepAwakeModule.deactivate();
    }
    return () => {
      KeepAwakeModule.deactivate();
    };
  }, [drivingMode]);

  // Animation for large microphone button when listening
  useEffect(() => {
    if (pipelineState === 'listening') {
      // Start pulsing animation
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(drivingMicScaleAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(drivingMicScaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      // Reset to normal size when not listening
      Animated.timing(drivingMicScaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [pipelineState, drivingMicScaleAnim]);

  // Dynamic styles that depend on the current theme
  const drivingStyles = useMemo(() => makeDrivingStyles(isDark), [isDark]);

  // State labels are resolved via i18n at render time so they always reflect
  // the current locale even if the user switches language mid-session.
  const stateLabel: Record<PipelineState, string> = {
    idle: t('home.state.idle'),
    listening: t('home.state.listening'),
    processing: t('home.state.processing'),
    speaking: t('home.state.speaking'),
    error: t('home.state.error'),
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#1C1C1E' : '#F2F2F7'}
      />

      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-surface-elevated">
        {/* Left: Avatar (opens menu) + name + status */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => setAvatarMenuVisible(true)} activeOpacity={0.7}>
            <SannaAvatar size={32} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-label-primary">Sanna</Text>
          <View className={`w-2 h-2 rounded-full ${STATE_COLORS[pipelineState]}`} />
          <Text className={`text-xs font-medium ${STATE_TEXT_COLORS[pipelineState]}`}>
            {stateLabel[pipelineState]}
          </Text>
        </View>

        {/* Right: Driving mode toggle only */}
        <TouchableOpacity
          className={`px-3 py-1.5 rounded-2xl ${drivingMode ? 'bg-accent-orange' : 'bg-surface-elevated'}`}
          onPress={onToggleDrivingMode}>
          <Text className="text-label-primary text-xs font-semibold">
            {drivingMode ? t('home.mode.driving') : t('home.mode.normal')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Avatar side-menu */}
      <AvatarMenu
        visible={avatarMenuVisible}
        onClose={() => setAvatarMenuVisible(false)}
        isDark={isDark}
        onToggleDarkMode={onToggleDarkMode}
        onSettingsPress={onSettingsPress}
        onDebugPress={() => setDebugVisible(true)}
        onListsPress={onListsPress}
        onSchedulesPress={onSchedulesPress}
        onNotificationListenersPress={onNotificationListenersPress}
        onJournalPress={onJournalPress}
        debugLogEnabled={debugLogEnabled}
      />

      {drivingMode ? (
        /* ── Driving Mode: Split layout ──────────────────────────────────── */
        <View className="flex-1">
          {/* Top half: large microphone button */}
          <View style={drivingStyles.drivingMicSection}>
            <View style={drivingStyles.drivingMicButtonRing}>
              <Animated.View style={{ transform: [{ scale: drivingMicScaleAnim }] }}>
                <TouchableOpacity
                  style={[
                    drivingStyles.drivingMicButton,
                    pipelineState === 'processing'
                      ? drivingStyles.drivingMicButtonBusy
                      : pipelineState === 'listening'
                      ? drivingStyles.drivingMicButtonListening
                      : drivingStyles.drivingMicButtonIdle,
                  ]}
                  onPress={onMicPress}
                  disabled={pipelineState === 'processing'}
                  activeOpacity={0.75}>
                  <Text style={drivingStyles.drivingMicIcon}>
                    {pipelineState === 'listening' ? '⏹️' : '🎤'}
                  </Text>
                  <Text style={drivingStyles.drivingMicLabel}>
                    {pipelineState === 'listening'
                      ? t('home.driving.tapToStop')
                      : pipelineState === 'processing'
                      ? t('home.driving.thinking')
                      : pipelineState === 'speaking'
                      ? t('home.driving.speaking')
                      : t('home.driving.micOn')}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* Bottom half: message bubbles */}
          <View style={drivingStyles.drivingBubblesSection}>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={
                messages.length === 0 && !historyLoading
                  ? { padding: 12, gap: 10, flex: 1 }
                  : { padding: 12, gap: 10, paddingBottom: 8 }
              }
              showsVerticalScrollIndicator={false}>
              {historyLoading ? (
                <View className="flex-1 items-center justify-center gap-2 py-8">
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text className="text-label-secondary text-sm">{t('home.loadingHistory')}</Text>
                </View>
              ) : messages.length === 0 ? (
                <View className="flex-1 items-center justify-center gap-2">
                  <Text className="text-label-secondary text-sm text-center">
                    {t('home.driving.tapMic')}
                  </Text>
                </View>
              ) : (
              messages.map((msg) => {
                // Use a stable key based on timestamp and text hash to prevent re-renders
                const key = `${msg.timestamp.getTime()}-${msg.text.slice(0, 20).replace(/\s/g, '')}`;
                return (
                  <MessageBubble key={key} message={msg} isDark={isDark} language={language} />
                );
              })
              )}
              {pipelineState === 'processing' && (
                <View className="flex-row items-center gap-2 py-1">
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text className="text-label-secondary text-sm">{t('home.thinking')}</Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* InputBar without microphone in driving mode */}
          <InputBar
            isBusy={isBusy}
            pipelineState={pipelineState}
            onMicPress={onMicPress}
            onSubmit={onTextSubmit}
            showMic={false}
          />
        </View>
      ) : (
        /* ── Normal Mode: Bubbles + InputBar ─────────────────────────────── */
        <View className="flex-1">
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={
              messages.length === 0 && !historyLoading
                ? { padding: 16, gap: 12, paddingBottom: 8, flex: 1 }
                : { padding: 16, gap: 12, paddingBottom: 8 }
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {historyLoading ? (
              <View className="flex-1 items-center justify-center py-16 gap-3">
                <SannaAvatar size={96} />
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 12 }} />
                <Text className="text-label-secondary text-sm">{t('home.loadingHistory')}</Text>
              </View>
            ) : messages.length === 0 ? (
              <View className="flex-1 items-center justify-center py-16 gap-3">
                <SannaAvatar size={96} />
                <Text className="text-label-primary text-lg font-bold">{t('home.empty.title')}</Text>
                <Text className="text-label-secondary text-sm text-center px-8">
                  {t('home.empty.subtitle')}
                </Text>
              </View>
            ) : (
              messages.map((msg) => {
                // Use a stable key based on timestamp and text hash to prevent re-renders
                const key = `${msg.timestamp.getTime()}-${msg.text.slice(0, 20).replace(/\s/g, '')}`;
                return (
                  <MessageBubble key={key} message={msg} isDark={isDark} language={language} />
                );
              })
            )}

            {pipelineState === 'processing' && (
              <View className="flex-row items-center gap-2 py-1">
                <ActivityIndicator size="small" color="#007AFF" />
                <Text className="text-label-secondary text-sm">{t('home.thinking')}</Text>
              </View>
            )}
          </ScrollView>

          {/* InputBar is memoized – parent re-renders don't cause focus loss */}
          <InputBar
            isBusy={isBusy}
            pipelineState={pipelineState}
            onMicPress={onMicPress}
            onSubmit={onTextSubmit}
          />
        </View>
      )}

      <DebugPanel 
        visible={debugVisible} 
        onClose={() => setDebugVisible(false)}
      />
    </View>
  );
}

// ─── InputBar (memoized to prevent keyboard dismissal on parent re-render) ────

interface InputBarProps {
  isBusy: boolean;
  pipelineState: PipelineState;
  onMicPress: () => void;
  onSubmit: (text: string) => void;
  showMic?: boolean;
}

const INPUT_DRAFT_KEY = 'sanna_input_draft';

const InputBar = React.memo(function InputBar({
  isBusy,
  pipelineState,
  onMicPress,
  onSubmit,
  showMic = true,
}: InputBarProps) {
  // Uncontrolled input: text lives in a ref, NOT in React state.
  // This avoids the New Architecture bug where setState() on every
  // keystroke causes the native TextInput to lose focus on Android.
  const textRef = useRef('');
  const inputRef = useRef<TextInput>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);
  
  // Animation for microphone button when listening
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Load saved draft text on mount
  useEffect(() => {
    AsyncStorage.getItem(INPUT_DRAFT_KEY).then(savedText => {
      if (savedText && savedText.trim() && inputRef.current) {
        textRef.current = savedText;
        // Use setNativeProps to set the text without triggering re-renders
        inputRef.current.setNativeProps({ text: savedText });
        isInitializedRef.current = true;
      }
    }).catch(() => {
      // Ignore errors
    });
  }, []);

  // Save text to AsyncStorage with debounce (500ms delay)
  const saveDraft = (text: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout to save after user stops typing
    saveTimeoutRef.current = setTimeout(() => {
      if (text.trim()) {
        AsyncStorage.setItem(INPUT_DRAFT_KEY, text).catch(() => {
          // Ignore errors
        });
      } else {
        // Clear draft if text is empty
        AsyncStorage.removeItem(INPUT_DRAFT_KEY).catch(() => {
          // Ignore errors
        });
      }
    }, 500);
  };

  useEffect(() => {
    if (pipelineState === 'listening') {
      // Start pulsing animation
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      // Reset to normal size when not listening
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [pipelineState, scaleAnim]);

  const handleSend = () => {
    const trimmed = textRef.current.trim();
    if (!trimmed || pipelineState === 'processing') return;
    
    // Clear saved draft when sending
    AsyncStorage.removeItem(INPUT_DRAFT_KEY).catch(() => {
      // Ignore errors
    });
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    inputRef.current?.clear();
    textRef.current = '';
    onSubmit(trimmed);
    // Re-focus so keyboard stays open after sending
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleTextChange = (text: string) => {
    textRef.current = text;
    saveDraft(text);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View>
      <View className="flex-row items-center gap-2 px-3 py-2.5 border-t border-surface-elevated bg-surface">
        {showMic && (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              className={`w-11 h-11 rounded-full items-center justify-center ${
                pipelineState === 'listening' ? 'bg-accent-red' : 'bg-surface-elevated'
              }`}
              onPress={onMicPress}
              disabled={pipelineState === 'processing'}
              activeOpacity={0.7}>
              <Text className="text-xl">
                {pipelineState === 'listening' ? '⏹️' : '🎤'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <TextInput
          ref={inputRef}
          className="flex-1 h-11 bg-surface-elevated rounded-full px-4 py-0 text-base text-label-primary"
          // No 'value' prop → uncontrolled → no re-render on each keystroke
          onChangeText={handleTextChange}
          onSubmitEditing={handleSend}
          placeholder={t('home.input.placeholder')}
          placeholderTextColor="#636366"
          returnKeyType="send"
          editable={pipelineState !== 'processing'}
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
          showSoftInputOnFocus={true}
        />

        <TouchableOpacity
          className="w-11 h-11 rounded-full bg-accent items-center justify-center"
          onPress={handleSend}
          disabled={isBusy}
          activeOpacity={0.7}>
          <Text className="text-lg text-label-primary">{isBusy ? '⏳' : '➤'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Theme-aware style factories ──────────────────────────────────────────────

function makeDrivingStyles(isDark: boolean) {
  const bg = isDark ? '#1C1C1E' : '#F2F2F7';
  const border = isDark ? '#3A3A3C' : '#E5E5EA';
  const labelColor = '#FFFFFF'; // button label always white (on coloured button)
  return StyleSheet.create({
    drivingMicSection: {
      height: 240,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: border,
      backgroundColor: bg,
      paddingVertical: 16,
    },
    drivingMicButtonRing: {
      width: 180,
      height: 180,
      borderRadius: 90,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    drivingMicButton: {
      width: 160,
      height: 160,
      borderRadius: 80,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 10,
    },
    drivingMicButtonIdle: {
      backgroundColor: '#007AFF',
      borderWidth: 3,
      borderColor: '#5AC8FA',
    },
    drivingMicButtonListening: {
      backgroundColor: '#FF3B30',
      borderWidth: 3,
      borderColor: '#FF6B5A',
    },
    drivingMicButtonBusy: {
      backgroundColor: isDark ? '#3A3A3C' : '#C7C7CC',
      borderWidth: 2,
      borderColor: isDark ? '#636366' : '#AEAEB2',
    },
    drivingMicIcon: {
      fontSize: 52,
    },
    drivingMicLabel: {
      color: labelColor,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    drivingBubblesSection: {
      flex: 1,
      backgroundColor: bg,
    },
  });
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({
  message,
  isDark,
  language,
}: {
  message: Message;
  isDark: boolean;
  language: string;
}): React.JSX.Element {
  const isUser = message.role === 'user';
  const time = message.timestamp.toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View
      className={`p-3 rounded-2xl gap-1 ${
        isUser
          ? 'max-w-[85%] self-end bg-accent rounded-br-sm'
          : 'w-[85%] self-start bg-surface-elevated rounded-bl-sm'
      }`}>
      <View className="flex-row items-center gap-1.5 mb-0.5">
        {isUser ? null : <SannaAvatar size={16} />}
        <Text
          className={`text-[11px] font-semibold ${
            isUser ? 'text-white/75' : 'text-accent'
          }`}>
          {isUser ? t('home.bubble.user') : t('home.bubble.assistant')}
        </Text>
      </View>
      {isUser ? (
        // User bubble has a blue (accent) background → text always white
        <Text className="text-[15px] leading-[21px] text-white">
          {message.text}
        </Text>
      ) : (
        <MarkdownText isDark={isDark}>{message.text}</MarkdownText>
      )}
      <Text className="text-[10px] text-label-quaternary self-end">{time}</Text>
    </View>
  );
});

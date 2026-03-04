/**
 * MiniMediaPlayer – Compact audio player for the header
 *
 * Shows play/pause, seek controls, and episode info when audio is playing.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import AudioPlayerModule, { AudioPlayerEvents, type AudioStatus } from '../native/AudioPlayerModule';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILE_KEY_PREFIX = 'sanna_file_';

interface EpisodeInfo {
  title: string;
  podcastName: string;
}

interface MiniMediaPlayerProps {
  isDark: boolean;
}

export function MiniMediaPlayer({ isDark }: MiniMediaPlayerProps): React.JSX.Element {
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [episodeInfo, setEpisodeInfo] = useState<EpisodeInfo | null>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [loadingEpisode, setLoadingEpisode] = useState(false);

  // Load episode info from file_storage based on URL
  const loadEpisodeInfo = useCallback(async (url: string | null) => {
    if (!url) {
      setEpisodeInfo(null);
      return;
    }

    setLoadingEpisode(true);
    try {
      const key = `${FILE_KEY_PREFIX}podcasts`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        setEpisodeInfo(null);
        return;
      }

      // Parse JSON and search for episode with matching URL
      const podcasts = JSON.parse(data);
      if (!podcasts.subscriptions || !Array.isArray(podcasts.subscriptions)) {
        setEpisodeInfo(null);
        return;
      }

      for (const podcast of podcasts.subscriptions) {
        if (podcast.episodes && Array.isArray(podcast.episodes)) {
          const episode = podcast.episodes.find((ep: { url?: string }) => ep.url === url);
          if (episode) {
            setEpisodeInfo({
              title: episode.title || 'Unknown Episode',
              podcastName: podcast.title || 'Unknown Podcast',
            });
            return;
          }
        }
      }

      // No episode found
      setEpisodeInfo(null);
    } catch (err) {
      console.error('Failed to load episode info:', err);
      setEpisodeInfo(null);
    } finally {
      setLoadingEpisode(false);
    }
  }, []);

  // Update status periodically
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const currentStatus = await AudioPlayerModule.getStatus();
        setStatus(currentStatus);
        
        // Load episode info if URL changed
        if (currentStatus.url && currentStatus.url !== status?.url) {
          loadEpisodeInfo(currentStatus.url);
        } else if (!currentStatus.url) {
          setEpisodeInfo(null);
        }
      } catch (err) {
        console.error('Failed to get audio status:', err);
      }
    };

    // Initial status check
    updateStatus();

    // Poll every 1 second
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [status?.url, loadEpisodeInfo]);

  // Listen to audio events
  useEffect(() => {
    const startedListener = AudioPlayerEvents.addListener('audio_started', (data: { url: string }) => {
      loadEpisodeInfo(data.url);
    });

    const pausedListener = AudioPlayerEvents.addListener('audio_paused', () => {
      // Status will be updated by polling
    });

    const completedListener = AudioPlayerEvents.addListener('audio_completed', () => {
      setStatus(null);
      setEpisodeInfo(null);
    });

    const stoppedListener = AudioPlayerEvents.addListener('audio_stopped', () => {
      setStatus(null);
      setEpisodeInfo(null);
    });

    return () => {
      startedListener.remove();
      pausedListener.remove();
      completedListener.remove();
      stoppedListener.remove();
    };
  }, [loadEpisodeInfo]);

  // Don't show if nothing is playing
  if (!status || status.status === 'stopped' || !status.url) {
    return <View />;
  }

  const handlePlayPause = async () => {
    try {
      if (status.status === 'playing') {
        await AudioPlayerModule.pause();
      } else {
        await AudioPlayerModule.resume();
      }
    } catch (err) {
      console.error('Failed to toggle play/pause:', err);
    }
  };

  const handleSeekBack = async () => {
    try {
      await AudioPlayerModule.seek(-10, true);
    } catch (err) {
      console.error('Failed to seek back:', err);
    }
  };

  const handleSeekForward = async () => {
    try {
      await AudioPlayerModule.seek(10, true);
    } catch (err) {
      console.error('Failed to seek forward:', err);
    }
  };

  const handleStop = async () => {
    try {
      await AudioPlayerModule.stop();
      setStatus(null);
      setEpisodeInfo(null);
    } catch (err) {
      console.error('Failed to stop:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 0 || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const positionStr = formatTime(status.position);
  const durationStr = formatTime(status.duration);
  const remainingStr = formatTime(status.duration > 0 ? status.duration - status.position : 0);

  return (
    <>
      <View className="flex-row items-center">
        {/* Seek back button */}
        <TouchableOpacity
          onPress={handleSeekBack}
          activeOpacity={0.7}
          className="p-1">
          <Text className="text-label-primary text-base">⏪</Text>
        </TouchableOpacity>

        {/* Play/Pause button */}
        <TouchableOpacity
          onPress={handlePlayPause}
          activeOpacity={0.7}
          className="p-1">
          <Text className="text-label-primary text-base">
            {status.status === 'playing' ? '⏸️' : '▶️'}
          </Text>
        </TouchableOpacity>

        {/* Seek forward button */}
        <TouchableOpacity
          onPress={handleSeekForward}
          activeOpacity={0.7}
          className="p-1">
          <Text className="text-label-primary text-base">⏩</Text>
        </TouchableOpacity>

        {/* Stop button */}
        <TouchableOpacity
          onPress={handleStop}
          activeOpacity={0.7}
          className="p-1">
          <Text className="text-label-primary text-base">⏹️</Text>
        </TouchableOpacity>

        {/* Info button */}
        <TouchableOpacity
          onPress={() => setInfoModalVisible(true)}
          activeOpacity={0.7}
          className="p-1">
          <Text className="text-label-primary text-base">ℹ️</Text>
        </TouchableOpacity>
      </View>

      {/* Info Modal */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
        statusBarTranslucent>
        <TouchableWithoutFeedback onPress={() => setInfoModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback>
              <View
                className="bg-surface rounded-2xl p-6 mx-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 16,
                  minWidth: 280,
                }}>
                {loadingEpisode ? (
                  <View className="items-center py-4">
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text className="text-label-secondary text-sm mt-2">Loading info...</Text>
                  </View>
                ) : (
                  <>
                    {episodeInfo ? (
                      <>
                        <Text className="text-label-primary text-lg font-bold mb-1">
                          {episodeInfo.title}
                        </Text>
                        <Text className="text-label-secondary text-sm mb-4">
                          {episodeInfo.podcastName}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-label-secondary text-sm mb-4">
                        Audio playback
                      </Text>
                    )}

                    <View className="border-t border-surface-elevated pt-4 gap-2">
                      <View className="flex-row justify-between">
                        <Text className="text-label-secondary text-sm">Position:</Text>
                        <Text className="text-label-primary text-sm font-medium">{positionStr}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-label-secondary text-sm">Duration:</Text>
                        <Text className="text-label-primary text-sm font-medium">{durationStr}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-label-secondary text-sm">Remaining:</Text>
                        <Text className="text-label-primary text-sm font-medium">{remainingStr}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => setInfoModalVisible(false)}
                      className="mt-4 py-2 px-4 bg-accent rounded-lg items-center">
                      <Text className="text-label-primary text-sm font-medium">Close</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

/**
 * DebugPanel – Collapsible panel showing agent logs in real-time
 *
 * Shows: system prompts, LLM calls, tool calls, tool results, errors
 * Tap a log entry to expand its full detail.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Share,
  Alert,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import { DebugLogger, type LogEntry, type LogLevel } from '../agent/debug-logger';
import { t } from '../i18n';

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: 'text-label-secondary',
  llm: 'text-accent-cyan',
  tool: 'text-accent-green',
  prompt: 'text-accent-orange',
  error: 'text-accent-red',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  info: 'ℹ️',
  llm: '🤖',
  tool: '🔧',
  prompt: '📝',
  error: '❌',
};

interface DebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

const ITEMS_PER_PAGE = 20;

export function DebugPanel({ visible, onClose }: DebugPanelProps): React.JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expandState, setExpandState] = useState<Record<number, 'preview' | 'full'>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<LogLevel | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Load existing entries
    setEntries(DebugLogger.getEntries());

    // Subscribe to new entries
    const unsub = DebugLogger.subscribe(() => {
      setEntries(DebugLogger.getEntries());
    });
    return unsub;
  }, []);

  // Reset to first page when entries or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [entries.length, activeFilter]);

  const filteredEntries = activeFilter
    ? entries.filter(e => e.level === activeFilter || e.tags?.includes(activeFilter))
    : entries;

  const handleFilterToggle = useCallback((level: LogLevel) => {
    setActiveFilter(prev => (prev === level ? null : level));
  }, []);

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentEntries = filteredEntries.slice(startIndex, endIndex);

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [totalPages]);

  const goToPreviousPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goToNextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  // Cycle: collapsed → preview → full → collapsed
  const toggleEntry = useCallback((id: number) => {
    setExpandState(prev => {
      const cur = prev[id];
      if (!cur) return { ...prev, [id]: 'preview' };
      if (cur === 'preview') return { ...prev, [id]: 'full' };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    DebugLogger.clear();
    setEntries([]);
  }, []);

  const handleDownload = useCallback(async () => {
    if (entries.length === 0) {
      return;
    }

    // Format all entries as text
    const lines: string[] = [];
    lines.push('=== SannaBot Debug Log ===');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Total entries: ${entries.length}`);
    lines.push('');
    lines.push('');

    // Sort entries by timestamp (oldest first for chronological order)
    const sortedEntries = [...entries].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    sortedEntries.forEach((entry, index) => {
      const timeStr = entry.timestamp.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const icon = LEVEL_ICONS[entry.level];
      
      lines.push(`[${index + 1}] ${timeStr} ${icon} [${entry.level.toUpperCase()}] [${entry.tag}]`);
      lines.push(`Summary: ${entry.summary}`);
      if (entry.detail) {
        lines.push('Detail:');
        lines.push(entry.detail);
      }
      lines.push('');
      lines.push('─'.repeat(80));
      lines.push('');
    });

    const textContent = lines.join('\n');

    // Threshold for when to save to file instead of sharing directly
    // Android has limits on share intent size (~1MB), so we use 900KB as threshold
    const MAX_SHARE_SIZE = 900_000; // ~900KB to be safe

    // Small delay to avoid timing issues with modal transitions
    await new Promise<void>(resolve => setTimeout(() => resolve(), 100));

    // If content is too large, save to file instead of sharing
    if (textContent.length > MAX_SHARE_SIZE) {
      try {
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `sannabot-debug-${timestamp}.txt`;
        
        // Determine file path based on platform
        let filePath: string;
        if (Platform.OS === 'android') {
          // Use Downloads directory on Android
          filePath = `${RNFS.DownloadDirectoryPath}/${filename}`;
        } else {
          // iOS: use DocumentDirectoryPath
          filePath = `${RNFS.DocumentDirectoryPath}/${filename}`;
        }

        // Write file
        await RNFS.writeFile(filePath, textContent, 'utf8');

        // Show success message with file path
        const fileSizeMB = (textContent.length / (1024 * 1024)).toFixed(2);
        Alert.alert(
          t('debug.fileSaved.title'),
          t('debug.fileSaved.message')
            .replace('{filename}', filename)
            .replace('{path}', filePath)
            .replace('{size}', fileSizeMB),
          [{ text: t('debug.fileSaved.ok') }]
        );
      } catch (error: unknown) {
        console.error('Error saving debug log to file:', error);
        Alert.alert(
          t('debug.fileSaveError.title'),
          t('debug.fileSaveError.message'),
          [{ text: t('debug.fileSaveError.ok') }]
        );
      }
      return;
    }

    // For smaller files, use the Share API as before
    try {
      // Use React Native Share API to allow saving/sharing
      const result = await Share.share({
        message: textContent,
        title: 'SannaBot Debug Log',
      });

      // On Android, result.action can be 'sharedAction' or 'dismissedAction'
      // On iOS, result.action can be 'sharedAction' or 'dismissedAction'
      if (result.action === Share.dismissedAction) {
        // User dismissed the share dialog - this is not an error
        return;
      }
    } catch (error: unknown) {
      console.error('Error sharing debug log:', error);
      
      // Show user-friendly error message
      const errorCode = (error as { code?: string })?.code;
      let errorMessage = t('debug.shareError.message.generic');
      
      if (errorCode === 'E_UNABLE_TO_OPEN_DIALOG') {
        errorMessage = t('debug.shareError.message.noApps');
      } else if (error instanceof Error) {
        errorMessage = t('debug.shareError.message.generic');
      }
      
      Alert.alert(
        t('debug.shareError.title'),
        errorMessage,
        [{ text: t('debug.shareError.ok') }]
      );
    }
  }, [entries]);

  return (
    <>
      {/* Full-screen modal with logs */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}>
        <View className="flex-1 bg-surface">
          {/* Header */}
          <View className="flex-row justify-between items-center px-4 pt-12 pb-3 border-b border-surface-elevated">
            <Text className="text-lg font-bold text-label-primary">{t('debug.title')}</Text>
            <View className="flex-row gap-2">
              {entries.length > 0 && (
                <TouchableOpacity
                  onPress={handleDownload}
                  className="w-10 h-10 items-center justify-center bg-surface-elevated rounded-lg">
                  <Text className="text-lg">📥</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleClear}
                className="w-10 h-10 items-center justify-center bg-surface-elevated rounded-lg">
                <Text className="text-lg">🗑️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                className="w-10 h-10 items-center justify-center bg-surface-elevated rounded-lg">
                <Text className="text-lg text-label-primary">✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Log entries */}
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ padding: 8, gap: 4 }}>
            {filteredEntries.length === 0 ? (
              <Text className="text-label-secondary text-sm text-center pt-16">
                {entries.length === 0
                  ? t('debug.empty')
                  : t('debug.filter.empty').replace('{level}', activeFilter ?? '')}
              </Text>
            ) : (
              currentEntries.map(entry => (
                <LogEntryRow
                  key={entry.id}
                  entry={entry}
                  expandLevel={expandState[entry.id]}
                  onToggle={toggleEntry}
                />
              ))
            )}
          </ScrollView>

          {/* Pagination controls */}
          {filteredEntries.length > ITEMS_PER_PAGE && (
            <View className="flex-row justify-between items-center px-4 py-3 border-t border-surface-elevated">
              <TouchableOpacity
                onPress={goToPreviousPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg ${
                  currentPage === 1
                    ? 'bg-surface-tertiary opacity-50'
                    : 'bg-surface-elevated'
                }`}>
                <Text
                  className={`text-sm font-semibold ${
                    currentPage === 1
                      ? 'text-label-tertiary'
                      : 'text-label-primary'
                  }`}>
                  ← Zurück
                </Text>
              </TouchableOpacity>

              <Text className="text-sm text-label-secondary">
                Seite {currentPage} von {totalPages} ({filteredEntries.length} Einträge)
              </Text>

              <TouchableOpacity
                onPress={goToNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg ${
                  currentPage === totalPages
                    ? 'bg-surface-tertiary opacity-50'
                    : 'bg-surface-elevated'
                }`}>
                <Text
                  className={`text-sm font-semibold ${
                    currentPage === totalPages
                      ? 'text-label-tertiary'
                      : 'text-label-primary'
                  }`}>
                  Weiter →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Legend / Filter */}
          <View className="flex-row justify-center items-center gap-3 py-2 border-t border-surface-elevated pb-6">
            {(['prompt', 'llm', 'tool', 'info', 'error'] as LogLevel[]).map(level => {
              const isActive = activeFilter === level;
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => handleFilterToggle(level)}
                  className={`flex-row items-center gap-1 px-2 py-1 rounded-full ${
                    isActive ? 'bg-surface-elevated' : 'opacity-60'
                  }`}
                  activeOpacity={0.7}>
                  <Text className="text-xs">{LEVEL_ICONS[level]}</Text>
                  <Text className={`text-[11px] font-semibold ${LEVEL_COLORS[level]}`}>{level}</Text>
                  {isActive && (
                    <Text className="text-[10px] text-label-tertiary ml-0.5">✕</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── LogEntryRow ────────────────────────────────────────────────────────────

const PREVIEW_CHARS = 3000;

interface LogEntryRowProps {
  entry: LogEntry;
  /** undefined = collapsed, 'preview' = truncated detail, 'full' = full detail */
  expandLevel?: 'preview' | 'full';
  onToggle: (id: number) => void;
}

const LogEntryRow = React.memo(function LogEntryRow({
  entry,
  expandLevel,
  onToggle,
}: LogEntryRowProps) {
  const timeStr = entry.timestamp.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const color = LEVEL_COLORS[entry.level];
  const icon = LEVEL_ICONS[entry.level];
  const hasDetail = !!entry.detail;
  const isOpen = !!expandLevel;
  const isFull = expandLevel === 'full';
  const needsTruncation = hasDetail && entry.detail!.length > PREVIEW_CHARS;

  const stateIcon = !isOpen ? '▶' : isFull ? '▼' : '▷';

  return (
    <TouchableOpacity
      className={`rounded-lg px-2.5 py-2 ${isOpen ? 'bg-surface-tertiary' : 'bg-surface-elevated'}`}
      onPress={() => hasDetail && onToggle(entry.id)}
      activeOpacity={hasDetail ? 0.6 : 1}>
      <View className="flex-row items-start gap-1 flex-wrap">
        <Text
          className="text-[10px] text-label-tertiary min-w-[56px]"
          style={{ fontFamily: 'monospace' }}
          selectable>
          {timeStr}
        </Text>
        <Text className="text-xs">{icon}</Text>
        <Text
          className={`text-[11px] font-bold ${color}`}
          style={{ fontFamily: 'monospace' }}
          selectable>
          [{entry.tag}]
        </Text>
        <Text
          className="flex-1 text-xs text-[#D1D1D6] leading-4"
          numberOfLines={isOpen ? 0 : 2}
          selectable>
          {entry.summary}
        </Text>
        {hasDetail && (
          <Text className="text-[10px] text-label-tertiary ml-1">
            {stateIcon}
          </Text>
        )}
      </View>
      {isOpen && entry.detail && (
        <View className="mt-2 bg-surface rounded-md p-2.5">
          <Text
            className="text-[11px] text-[#A1A1A6] leading-4"
            style={{ fontFamily: 'monospace' }}
            selectable>
            {isFull ? entry.detail : entry.detail.slice(0, PREVIEW_CHARS)}
            {!isFull && needsTruncation
              ? `\n\n⬇️ ${t('debug.tapForMore')}`
              : ''}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

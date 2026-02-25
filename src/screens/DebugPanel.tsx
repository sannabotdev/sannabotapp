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
} from 'react-native';
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

export function DebugPanel({ visible, onClose }: DebugPanelProps): React.JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expandState, setExpandState] = useState<Record<number, 'preview' | 'full'>>({});
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
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleClear}
                className="px-3 py-1.5 bg-surface-elevated rounded-lg">
                <Text className="text-accent-orange text-sm font-semibold">{t('debug.clear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                className="px-3 py-1.5 bg-surface-elevated rounded-lg">
                <Text className="text-accent-red text-sm font-semibold">{t('debug.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Log entries */}
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ padding: 8, gap: 4 }}>
            {entries.length === 0 ? (
              <Text className="text-label-secondary text-sm text-center pt-16">
                {t('debug.empty')}
              </Text>
            ) : (
              entries.map(entry => (
                <LogEntryRow
                  key={entry.id}
                  entry={entry}
                  expandLevel={expandState[entry.id]}
                  onToggle={toggleEntry}
                />
              ))
            )}
          </ScrollView>

          {/* Legend */}
          <View className="flex-row justify-center gap-4 py-2 border-t border-surface-elevated pb-6">
            {(['prompt', 'llm', 'tool', 'info', 'error'] as LogLevel[]).map(level => (
              <View key={level} className="flex-row items-center gap-1">
                <Text className="text-xs">{LEVEL_ICONS[level]}</Text>
                <Text className={`text-[11px] font-semibold ${LEVEL_COLORS[level]}`}>{level}</Text>
              </View>
            ))}
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

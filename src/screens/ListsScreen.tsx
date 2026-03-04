/**
 * ListsScreen – View and manage all stored lists
 *
 * Shows all lists stored via FileStorageTool (AsyncStorage key prefix: sanna_file_).
 * Each list is shown as a collapsible entry. Items can be deleted individually
 * in edit mode. The entire list can also be deleted.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';

const FILE_KEY_PREFIX = 'sanna_file_';
const TYPE_KEY_PREFIX = 'sanna_file_';
const TYPE_KEY_SUFFIX = '_type';

interface ListEntry {
  name: string;
  items: string[];
}

interface ListsScreenProps {
  onBack: () => void;
}

export function ListsScreen({ onBack }: ListsScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [editingList, setEditingList] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const fileKeys = (allKeys as readonly string[]).filter(k =>
        k.startsWith(FILE_KEY_PREFIX) && !k.endsWith(TYPE_KEY_SUFFIX),
      );
      const entries: ListEntry[] = [];
      for (const key of fileKeys) {
        const name = key.slice(FILE_KEY_PREFIX.length);
        // Check if this file has type "list" (or no type for backward compatibility)
        const typeKey = `${TYPE_KEY_PREFIX}${name}${TYPE_KEY_SUFFIX}`;
        const fileType = await AsyncStorage.getItem(typeKey);
        // Only include files with type "list" or no type (backward compatibility)
        if (fileType !== null && fileType !== 'list') {
          continue;
        }
        const content = await AsyncStorage.getItem(key);
        const items = content
          ? content.split('\n').filter(l => l.trim().length > 0)
          : [];
        entries.push({ name, items });
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      setLists(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleToggle = (name: string) => {
    setExpandedList(prev => (prev === name ? null : name));
    if (editingList === name) {
      setEditingList(null);
    }
  };

  const handleDeleteList = (name: string) => {
    Alert.alert(
      `${t('lists.delete.title')}: "${name}"`,
      t('lists.delete.message'),
      [
        { text: t('lists.delete.cancel'), style: 'cancel' },
        {
          text: t('lists.delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(`${FILE_KEY_PREFIX}${name}`);
            // Also delete type metadata
            await AsyncStorage.removeItem(`${TYPE_KEY_PREFIX}${name}${TYPE_KEY_SUFFIX}`);
            if (expandedList === name) setExpandedList(null);
            if (editingList === name) setEditingList(null);
            await loadLists();
          },
        },
      ],
    );
  };

  const handleDeleteItem = async (listName: string, itemIndex: number) => {
    const key = `${FILE_KEY_PREFIX}${listName}`;
    const content = await AsyncStorage.getItem(key);
    if (!content) return;
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    lines.splice(itemIndex, 1);
    await AsyncStorage.setItem(key, lines.join('\n'));
    await loadLists();
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-surface-elevated gap-3">
        <TouchableOpacity onPress={onBack} className="p-1">
          <Text className="text-accent text-base">{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text className="text-label-primary text-lg font-bold">{t('lists.title')}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : lists.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-label-secondary text-base text-center">
            {t('lists.empty')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          {lists.map(list => {
            const isExpanded = expandedList === list.name;
            const isEditing = editingList === list.name;
            const itemLabel =
              list.items.length === 1
                ? `1 ${t('lists.item.singular')}`
                : `${list.items.length} ${t('lists.item.plural')}`;
            return (
              <View key={list.name} className="bg-surface-elevated rounded-xl overflow-hidden">
                {/* List header row */}
                <TouchableOpacity
                  onPress={() => handleToggle(list.name)}
                  activeOpacity={0.7}
                  className="flex-row items-center px-4 py-3 gap-3">
                  <Text className="text-label-secondary text-lg">
                    {isExpanded ? '▾' : '▸'}
                  </Text>
                  <Text className="flex-1 text-label-primary text-base font-semibold capitalize">
                    {list.name}
                  </Text>
                  <Text className="text-label-secondary text-sm">{itemLabel}</Text>
                </TouchableOpacity>

                {/* Expanded content */}
                {isExpanded && (
                  <View className="border-t border-surface">
                    {/* Action buttons */}
                    <View className="flex-row gap-2 px-4 py-2 border-b border-surface items-center justify-end">
                      <TouchableOpacity
                        onPress={() => setEditingList(isEditing ? null : list.name)}
                        activeOpacity={0.7}
                        style={{ width: 28, height: 28 }}
                        className={`rounded-full items-center justify-center ${isEditing ? 'bg-accent' : 'bg-surface-tertiary'}`}>
                        <Text className={`text-[13px] leading-none ${isEditing ? 'text-white' : 'text-label-primary'}`}>
                          {isEditing ? '✓' : '✏️'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteList(list.name)}
                        activeOpacity={0.7}
                        style={{ width: 28, height: 28 }}
                        className="rounded-full bg-surface-tertiary items-center justify-center">
                        <Text className="text-label-primary text-[13px] leading-none">🗑️</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Items */}
                    {list.items.length === 0 ? (
                      <View className="px-4 py-3">
                        <Text className="text-label-secondary text-sm italic">
                          {t('lists.items.empty')}
                        </Text>
                      </View>
                    ) : (
                      list.items.map((item, idx) => (
                        <View
                          key={idx}
                          className="flex-row items-center px-4 py-2.5 border-b border-surface">
                          <Text className="text-label-secondary text-sm mr-2">•</Text>
                          <Text className="flex-1 text-label-primary text-sm">{item}</Text>
                          {isEditing && (
                            <TouchableOpacity
                              onPress={() => handleDeleteItem(list.name, idx)}
                              activeOpacity={0.7}
                              className="ml-2 w-6 h-6 rounded-full bg-accent-red items-center justify-center">
                              <Text className="text-white text-xs font-bold">✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

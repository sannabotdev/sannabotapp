/**
 * EditableDetailRow – A detail row with inline editing via small icon buttons.
 *
 * Normal state:   Label | Value | ✏️
 * Edit state:     Label
 *                 [ TextInput        ] ✓ ✕
 */
import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { t } from '../i18n';

interface EditableDetailRowProps {
  label: string;
  value: string;
  /** Called with the trimmed new value when the user taps ✓ */
  onSave: (newValue: string) => Promise<void> | void;
  /** Width of the label column (default 96) */
  labelWidth?: number;
  /** Placeholder shown when value is empty and not editing */
  placeholder?: string;
}

export function EditableDetailRow({
  label,
  value,
  onSave,
  labelWidth = 96,
  placeholder,
}: EditableDetailRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <View className="gap-1">
        <Text className="text-label-secondary text-xs">{label}</Text>
        <View className="flex-row items-start gap-2">
          <TextInput
            className="text-label-primary text-xs flex-1 bg-surface rounded-lg px-2 py-1.5"
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            editable={!saving}
            placeholder={placeholder}
            placeholderTextColor="#666"
            style={{ minHeight: 32, textAlignVertical: 'top' }}
          />
          <View className="flex-row gap-1 pt-0.5">
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityLabel={t('common.save')}
              style={{ width: 26, height: 26 }}
              className="rounded-full bg-green-500/20 items-center justify-center">
              <Text className="text-green-400 text-sm leading-none">✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityLabel={t('common.cancel')}
              style={{ width: 26, height: 26 }}
              className="rounded-full bg-red-500/15 items-center justify-center">
              <Text className="text-label-secondary text-sm leading-none">✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row gap-2 items-start">
      <Text
        className="text-label-secondary text-xs shrink-0"
        style={{ width: labelWidth }}>
        {label}
      </Text>
      <Text className="text-label-primary text-xs flex-1">
        {value || placeholder || ''}
      </Text>
      <TouchableOpacity
        onPress={handleEdit}
        activeOpacity={0.7}
        accessibilityLabel={t('common.edit')}
        style={{ width: 24, height: 24 }}
        className="rounded-full bg-accent/15 items-center justify-center">
        <Text className="text-accent text-[11px] leading-none">✏️</Text>
      </TouchableOpacity>
    </View>
  );
}

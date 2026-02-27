import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

interface AgentSectionProps {
  maxIterations: number;
  onMaxIterationsChange: (value: number) => void;
  maxSubAgentIterations: number;
  onMaxSubAgentIterationsChange: (value: number) => void;
  maxAccessibilityIterations: number;
  onMaxAccessibilityIterationsChange: (value: number) => void;
}

function IterationInput({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  const [text, setText] = useState(String(value));

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    // Reset display to last valid value if input is invalid
    const parsed = parseInt(text, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
      setText(String(value));
    }
  };

  return (
    <View
      className="px-4 py-3 border-b border-surface-tertiary"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-label-primary text-[15px] font-medium">{label}</Text>
          <Text className="text-label-secondary text-[12px] mt-0.5">{description}</Text>
        </View>
        <TextInput
          className="w-16 h-9 bg-surface-elevated rounded-lg px-2 text-center text-label-primary text-base font-semibold"
          value={text}
          onChangeText={handleChange}
          onBlur={handleBlur}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
      </View>
      {(() => {
        const parsed = parseInt(text, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 50) {
          return (
            <Text className="text-red-500 text-[11px] mt-1">
              Bitte einen Wert zwischen 1 und 50 eingeben
            </Text>
          );
        }
        return null;
      })()}
    </View>
  );
}

export function AgentSection({
  maxIterations,
  onMaxIterationsChange,
  maxSubAgentIterations,
  onMaxSubAgentIterationsChange,
  maxAccessibilityIterations,
  onMaxAccessibilityIterationsChange,
}: AgentSectionProps): React.JSX.Element {
  return (
    <>
      <View
        className="px-4 py-2 border-b border-surface-tertiary"
        style={{ borderBottomWidth: StyleSheet.hairlineWidth }}>
        <Text className="text-label-secondary text-[12px]">
          Legt fest, wie viele Runden das LLM maximal pro Anfrage durchlaufen darf, bevor es abbricht.
        </Text>
      </View>

      <IterationInput
        label="Haupt-Agent"
        description="Conversation Pipeline (Normal- & Fahrmodus)"
        value={maxIterations}
        onChange={onMaxIterationsChange}
      />

      <IterationInput
        label="Sub-Agent (Benachrichtigung & Zeitplan)"
        description="Notification- und Scheduler-Sub-Agents"
        value={maxSubAgentIterations}
        onChange={onMaxSubAgentIterationsChange}
      />

      <IterationInput
        label="Accessibility Sub-Agent"
        description="UI-Automatisierung (Apps steuern)"
        value={maxAccessibilityIterations}
        onChange={onMaxAccessibilityIterationsChange}
      />
    </>
  );
}

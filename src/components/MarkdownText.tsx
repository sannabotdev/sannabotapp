/**
 * MarkdownText – Reusable Markdown component with automatic theme detection
 *
 * Automatically detects dark/light mode and applies appropriate styles.
 * Can optionally accept isDark prop to override auto-detection.
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface MarkdownTextProps {
  children: string;
  /** Optional: override auto-detected theme */
  isDark?: boolean;
}

function makeMdStyles(isDark: boolean) {
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const codeBg = isDark ? '#3A3A3C' : '#E5E5EA';
  const divColor = isDark ? '#636366' : '#C7C7CC';
  return StyleSheet.create({
    body: { color: textColor, fontSize: 15, lineHeight: 21, backgroundColor: 'transparent' },
    paragraph: { marginTop: 0, marginBottom: 4, width: 'auto' },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    heading1: { fontSize: 20, fontWeight: '700', color: textColor, marginTop: 8, marginBottom: 4 },
    heading2: { fontSize: 18, fontWeight: '700', color: textColor, marginTop: 6, marginBottom: 4 },
    heading3: { fontSize: 16, fontWeight: '700', color: textColor, marginTop: 4, marginBottom: 2 },
    bullet_list: { marginTop: 2, marginBottom: 2 },
    ordered_list: { marginTop: 2, marginBottom: 2 },
    list_item: { marginTop: 1, marginBottom: 1, flexDirection: 'row', alignItems: 'flex-start' },
    bullet_list_content: { flex: 1 },
    ordered_list_content: { flex: 1 },
    code_inline: {
      backgroundColor: codeBg,
      color: '#5AC8FA',
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: codeBg,
      color: '#5AC8FA',
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      padding: 10,
      borderRadius: 8,
      marginTop: 4,
      marginBottom: 4,
    },
    code_block: {
      backgroundColor: codeBg,
      color: '#5AC8FA',
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      padding: 10,
      borderRadius: 8,
      marginTop: 4,
      marginBottom: 4,
    },
    blockquote: {
      backgroundColor: codeBg,
      borderLeftColor: '#007AFF',
      borderLeftWidth: 3,
      paddingLeft: 8,
      paddingVertical: 4,
      marginTop: 4,
      marginBottom: 4,
    },
    link: { color: '#007AFF', textDecorationLine: 'underline' },
    hr: { backgroundColor: divColor, height: 1, marginVertical: 8 },
    table: { borderColor: divColor },
    tr: { borderBottomColor: divColor },
    th: { color: textColor, fontWeight: '700', padding: 4 },
    td: { color: textColor, padding: 4 },
  });
}

export function MarkdownText({ children, isDark }: MarkdownTextProps): React.JSX.Element {
  // Auto-detect theme if not provided
  const colorScheme = useColorScheme();
  const effectiveIsDark = isDark ?? (colorScheme === 'dark');

  const mdStyles = useMemo(() => makeMdStyles(effectiveIsDark), [effectiveIsDark]);

  return <Markdown style={mdStyles}>{children}</Markdown>;
}

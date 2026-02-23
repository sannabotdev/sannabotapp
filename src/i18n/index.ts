/**
 * Lightweight i18n module for SannaBot
 *
 * Usage:
 *   import { t, setLocale, getLocale } from '../i18n';
 *   setLocale('de');
 *   t('home.ready') // → 'Bereit'
 *
 * Locale resolution order:
 *   1. Exact match (e.g. 'de-AT' → 'de-AT' locale file if it exists)
 *   2. Language prefix match (e.g. 'de-AT' → 'de' locale file)
 *   3. English fallback
 *
 * 'system' resolves to the device locale via Intl API, then falls back to 'en'.
 */

import { Platform } from 'react-native';
import en from './locales/en';
import de from './locales/de';

export type Translations = typeof en;
export type TranslationKey = keyof Translations;

type LocaleMap = Record<string, Translations>;

const LOCALES: LocaleMap = {
  en,
  de,
};

/** Currently active translations */
let activeTranslations: Translations = en;
let activeLocale = 'en';

/** Resolve the device system locale to a BCP-47 tag */
function resolveSystemLocale(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.replace('_', '-');
  } catch {
    return Platform.OS === 'android' ? 'de-AT' : 'en-US';
  }
}

/**
 * Resolve a locale tag to the best available Translations object.
 * Falls back to English if no matching locale exists.
 */
function resolveTranslations(lang: string): { translations: Translations; resolvedLocale: string } {
  // Exact match
  if (LOCALES[lang]) {
    return { translations: LOCALES[lang], resolvedLocale: lang };
  }
  // Language prefix (e.g. 'de-AT' → 'de')
  const prefix = lang.split('-')[0].toLowerCase();
  if (LOCALES[prefix]) {
    return { translations: LOCALES[prefix], resolvedLocale: prefix };
  }
  // English fallback
  return { translations: en, resolvedLocale: 'en' };
}

/**
 * Set the active locale.
 * Pass 'system' to auto-detect from the device.
 */
export function setLocale(lang: 'system' | string): void {
  const resolved = lang === 'system' ? resolveSystemLocale() : lang;
  const { translations, resolvedLocale } = resolveTranslations(resolved);
  activeTranslations = translations;
  activeLocale = resolvedLocale;
}

/** Get the currently active locale code (e.g. 'en', 'de') */
export function getLocale(): string {
  return activeLocale;
}

/**
 * Get the full BCP-47 locale code for the current language.
 * Used for TTS and date formatting.
 * Returns e.g. 'de-AT' for 'de', 'en-US' for 'en'.
 */
export function getLocaleBCP47(): string {
  const map: Record<string, string> = {
    de: 'de-AT',
    en: 'en-US',
  };
  return map[activeLocale] ?? activeLocale;
}

/**
 * Translate a key. Returns the English fallback if the key is missing in the
 * active locale.
 */
export function t(key: TranslationKey): string {
  const val = activeTranslations[key];
  if (val !== undefined) return val;
  // Fallback to English
  return en[key] ?? key;
}

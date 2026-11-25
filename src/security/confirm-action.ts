/**
 * createConfirmFn – asks the user to approve a sensitive action.
 *
 *  - Normal mode:  on-screen dialog (Allow / Cancel).
 *  - Driving mode: Sanna speaks the action and listens for "yes" / "no"
 *                  (multi-language). Falls back to the dialog if speech
 *                  recognition is unavailable.
 *
 * Anything other than an explicit yes – silence, a timeout, an unclear
 * answer, an error – counts as NO.
 */
import { Alert } from 'react-native';
import { t, type TranslationKey } from '../i18n';
import type { TTSService } from '../audio/tts-service';
import type { STTService } from '../audio/stt-service';
import type { ConfirmFn } from '../agent/tool-registry';
import { fillTemplate, parseSpokenConfirmation } from './safety-policy';

/** How long to wait for a tap on the dialog before treating it as "no". */
const DIALOG_TIMEOUT_MS = 60_000;

export interface ConfirmDeps {
  /** Read on every call so toggling driving mode takes effect immediately. */
  isDrivingMode: () => boolean;
  /** BCP-47 language for TTS/STT, e.g. 'en-US', 'he-IL'. */
  getLanguage: () => string;
  tts: TTSService;
  stt: STTService;
}

function fill(template: string, summary: string): string {
  return template.replace('{summary}', summary);
}

/** Message in the app's language, falling back to the English summary. */
export function localizeSummary(
  summary: string,
  messageKey?: string,
  params?: Record<string, string>,
): string {
  if (!messageKey) return summary;
  const tpl = t(messageKey as TranslationKey);
  if (!tpl || tpl === messageKey) return summary;
  return fillTemplate(tpl, params ?? {});
}

export function confirmWithDialog(summary: string): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const done = (v: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done(false), DIALOG_TIMEOUT_MS);
    Alert.alert(
      t('safety.confirm.title'),
      summary,
      [
        { text: t('safety.confirm.deny'), style: 'cancel', onPress: () => done(false) },
        { text: t('safety.confirm.allow'), style: 'destructive', onPress: () => done(true) },
      ],
      { cancelable: true, onDismiss: () => done(false) },
    );
  });
}

async function confirmByVoice(summary: string, deps: ConfirmDeps): Promise<boolean> {
  const lang = deps.getLanguage();
  await deps.tts.speak(fill(t('safety.confirm.spoken'), summary), lang);
  for (let attempt = 0; attempt < 2; attempt++) {
    const heard = await deps.stt.listen(lang);
    if (heard.trim()) {
      return parseSpokenConfirmation(heard);
    }
    if (attempt === 0) {
      await deps.tts.speak(t('safety.confirm.spokenRetry'), lang);
    }
  }
  return false;
}

export function createConfirmFn(deps: ConfirmDeps): ConfirmFn {
  // Serialize: never show two confirmations at once.
  let queue: Promise<unknown> = Promise.resolve();

  return (englishSummary: string, messageKey?: string, params?: Record<string, string>) => {
    const summary = localizeSummary(englishSummary, messageKey, params);
    const run = async (): Promise<boolean> => {
      if (deps.isDrivingMode()) {
        try {
          return await confirmByVoice(summary, deps);
        } catch {
          // Speech recognition failed – fall back to the dialog.
        }
      }
      return confirmWithDialog(summary);
    };
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    return p;
  };
}

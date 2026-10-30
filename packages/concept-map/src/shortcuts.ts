import type { Locale } from '@nesso-how/i18n'
import { translate } from './i18n/index.ts'

export function conceptMapShortcuts(locale: Locale) {
  const t = translate(locale)
  const modifier =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
  return {
    title: t('shortcutsTitle'),
    rows: [
      { label: t('shortcutRename'), keys: [['Enter']] },
      { label: t('shortcutBold'), keys: [[modifier, 'B']] },
      { label: t('shortcutItalic'), keys: [[modifier, 'I']] },
      { label: t('shortcutFitView'), keys: [['F']] },
      { label: t('shortcutOutside'), keys: [['O']] },
    ],
  }
}

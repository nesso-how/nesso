import type { Locale } from '@nesso-how/i18n'
import { translate } from './i18n/index.ts'

export function conceptMapShortcuts(locale: Locale) {
  const t = translate(locale)
  return {
    title: t('shortcutsTitle'),
    rows: [
      { label: t('shortcutRename'), keys: [['Enter']] },
      { label: t('shortcutFitView'), keys: [['F']] },
      { label: t('shortcutOutside'), keys: [['O']] },
    ],
  }
}

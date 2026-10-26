import { createTranslator, defaultLocale } from '@nesso-how/i18n'
import { useNesso } from '../store'
import { useMemo } from 'react'
import en from './en.json'
import it from './it.json'
import zhCN from './zh-CN.json'

export const translate = createTranslator(en, { it, 'zh-CN': zhCN })

export function useTranslation() {
  const locale = useNesso((state) => state.preferences.locale ?? defaultLocale)
  return useMemo(() => translate(locale), [locale])
}

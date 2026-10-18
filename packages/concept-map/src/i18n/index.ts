import { createTranslator, defaultLocale } from '@nesso/i18n'
import { useNesso } from '../store'
import { useMemo } from 'react'
import en from './en.json'
import it from './it.json'
import zhCN from './zh-CN.json'

const translate = createTranslator(en, { it, 'zh-CN': zhCN })

export function useTranslation() {
  const locale = useNesso((state) => state.preferences.locale ?? defaultLocale)
  return useMemo(() => translate(locale), [locale])
}

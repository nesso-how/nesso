import { createTranslator, defaultLocale } from '@nesso/i18n'
import { useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import en from './en.json'
import it from './it.json'
import zhCN from './zh-CN.json'

export const translate = createTranslator(en, { it, 'zh-CN': zhCN })

export function useTranslation(store?: HostStore) {
  return translate(useNessoStore((state) => state.preferences.locale ?? defaultLocale, store))
}

import { createTranslator, defaultLocale } from '@nesso/i18n'
import { useNesso } from '../store'
import en from './en.json'
import it from './it.json'
import zhCN from './zh-CN.json'

export const translate = createTranslator(en, { it, 'zh-CN': zhCN })

export function useTranslation() {
  return translate(useNesso((state) => state.preferences.locale ?? defaultLocale))
}

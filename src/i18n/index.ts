import { createTranslator, defaultLocale } from '@nesso/i18n'
import { useNessoStore } from '@/store'
import en from './en.json'
import it from './it.json'

export const translate = createTranslator(en, { it })

export function useTranslation() {
  return translate(useNessoStore((state) => state.preferences.locale ?? defaultLocale))
}

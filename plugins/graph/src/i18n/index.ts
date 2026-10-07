import { createTranslator, defaultLocale } from '@nesso/i18n'
import { useNesso } from '../store'
import en from './en.json'
import it from './it.json'

export const translate = createTranslator(en, { it })

export function useTranslation() {
  return translate(useNesso((state) => state.preferences.locale ?? defaultLocale))
}

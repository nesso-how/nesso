export const locales = ['en', 'it', 'zh-CN'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
export const localeNames: Readonly<Record<Locale, string>> = {
  en: 'English',
  it: 'Italiano',
  'zh-CN': '简体中文',
}

export const isLocale = (value: unknown): value is Locale =>
  locales.some((locale) => locale === value)

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    let locale: Intl.Locale
    try {
      locale = new Intl.Locale(language)
    } catch {
      continue
    }
    if (isLocale(locale.language)) return locale.language
    if (locale.language === 'zh' && locale.maximize().script === 'Hans') return 'zh-CN'
  }
  return defaultLocale
}

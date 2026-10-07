import { createInstance } from 'i18next'

export const locales = ['en', 'it'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'en'
export const localeNames: Readonly<Record<Locale, string>> = { en: 'English', it: 'Italiano' }

export type Catalog = Readonly<Record<string, string>>
type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
type BaseKey<K extends string> = K extends `${infer Key}_${PluralForm}` ? Key : K
type TranslationKey<C extends Catalog> = BaseKey<keyof C & string>
export type Translation<C extends Catalog> = Readonly<Partial<Record<keyof C | `${TranslationKey<C>}_${PluralForm}`, string>>>
export type Values = Readonly<Record<string, string | number>>

export class I18nError extends Error {
  override name = 'I18nError'
  readonly issues: { path: string; message: string }[]
  constructor(issues: { path: string; message: string }[]) {
    super(issues.map(({ path, message }) => (path ? `${path}: ${message}` : message)).join('\n'))
    this.issues = issues
  }
}

export const isLocale = (value: unknown): value is Locale => locales.some((locale) => locale === value)

export function createTranslator<C extends Catalog>(english: C, translations: Readonly<Partial<Record<Locale, Translation<C>>>> = {}) {
  const instance = createInstance()
  void instance.init({
    initAsync: false,
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: [...locales],
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    resources: Object.fromEntries(Object.entries({ ...translations, en: english }).map(([locale, catalog]) => [locale, { translation: catalog }])),
  })

  return (locale: Locale) => (key: TranslationKey<C>, values: Values = {}): string => {
    if (english[`${key}_other`] !== undefined && (typeof values.count !== 'number' || !Number.isFinite(values.count))) {
      throw new I18nError([{ path: `${key}.count`, message: 'Expected a finite count for a plural message' }])
    }
    const options = { lng: locale, count: typeof values.count === 'number' ? values.count : undefined, replace: values }
    if (!instance.exists(key, options)) throw new I18nError([{ path: key, message: 'Unknown translation key' }])
    return instance.t(key, {
      ...options,
      missingInterpolationHandler: (_: string, match: RegExpExecArray) => {
        throw new I18nError([{ path: `${key}.${match[1].trim()}`, message: 'Missing interpolation value' }])
      },
    })
  }
}

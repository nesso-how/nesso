export const locales = ['en', 'it'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'en'
export const localeNames: Readonly<Record<Locale, string>> = { en: 'English', it: 'Italiano' }

export type Message = string | { readonly one: string; readonly other: string }
export type Catalog = Readonly<Record<string, Message>>
type Localized<M extends Message> = M extends string ? string : Exclude<Message, string>
export type Translation<C extends Catalog> = { readonly [K in keyof C]?: Localized<C[K]> }
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
  return (locale: Locale) => (key: keyof C & string, values: Values = {}): string => {
    const message = translations[locale]?.[key] ?? english[key]
    if (message === undefined) throw new I18nError([{ path: key, message: 'Unknown translation key' }])
    if (typeof message !== 'string' && (typeof values.count !== 'number' || !Number.isFinite(values.count))) {
      throw new I18nError([{ path: `${key}.count`, message: 'Expected a finite count for a plural message' }])
    }
    const text = typeof message === 'string' ? message : message[new Intl.PluralRules(locale).select(values.count as number) === 'one' ? 'one' : 'other']
    return text.replace(/\{(\w+)\}/g, (_, name: string) => {
      if (values[name] === undefined) throw new I18nError([{ path: `${key}.${name}`, message: 'Missing interpolation value' }])
      return String(values[name])
    })
  }
}

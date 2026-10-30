import { defaultLocale, detectLocale, isLocale } from '@nesso-how/i18n/locale'

export function siteLocaleRedirect(
  pathname: string,
  savedLocale: unknown,
  languages: readonly string[],
): string | null {
  if (pathname !== '/') return null
  const locale = isLocale(savedLocale) ? savedLocale : detectLocale(languages)
  return locale === defaultLocale ? null : `/${locale}/`
}

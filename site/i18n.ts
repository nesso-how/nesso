import { createTranslator, defaultLocale, localeNames, locales, type Locale } from '@nesso-how/i18n'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }
import zhCN from './i18n/zh-CN.json' with { type: 'json' }

const translate = createTranslator(en, { it, 'zh-CN': zhCN })
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
const localePath = (locale: Locale) => (locale === defaultLocale ? '/' : `/${locale}/`)

export function renderSite(html: string, locale: Locale, version: string): string {
  const t = translate(locale)
  const page = {
    lang: locale,
    pagePath: localePath(locale),
    pageUrl: `https://nesso.how${localePath(locale)}`,
    languageName: localeNames[locale],
  }
  const alternates = locales
    .map(
      (language) =>
        `<link rel="alternate" hreflang="${language}" href="https://nesso.how${localePath(language)}">`,
    )
    .join('\n')
  const languages = locales
    .map(
      (language) =>
        `<a href="${localePath(language)}" lang="${language}" hreflang="${language}"${language === locale ? ' aria-current="page"' : ''}>${escapeHtml(localeNames[language])}</a>`,
    )
    .join('\n')
  return html
    .replaceAll('%NESSO_VERSION%', escapeHtml(version))
    .replace(/{{(\w+)}}/g, (_, key: string) => {
      if (key === 'alternateLinks')
        return `${alternates}\n<link rel="alternate" hreflang="x-default" href="https://nesso.how/">`
      if (key === 'languageLinks') return languages
      if (key in page) return escapeHtml(page[key as keyof typeof page])
      return escapeHtml(t(key as keyof typeof en, { version, platform: '{platform}' }))
    })
}

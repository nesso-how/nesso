import { createTranslator, defaultLocale, localeNames, locales, type Locale } from '@nesso-how/i18n'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }
import zhCN from './i18n/zh-CN.json' with { type: 'json' }
import example from './data-example.json' with { type: 'json' }
import { desktopDownload } from './platform.ts'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

const translate = createTranslator(en, { it, 'zh-CN': zhCN })
const highlighter = hljs.newInstance()
highlighter.registerLanguage('json', json)
const jsonExample = highlighter.highlight(JSON.stringify(example, null, 2), {
  language: 'json',
}).value
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
const localePath = (locale: Locale) => (locale === defaultLocale ? '/' : `/${locale}/`)
const ogLocales = { en: 'en_US', it: 'it_IT', 'zh-CN': 'zh_CN' }

export function renderSite(html: string, locale: Locale, version: string): string {
  const t = translate(locale)
  const page = {
    lang: locale,
    pagePath: localePath(locale),
    pageUrl: `https://nesso.how${localePath(locale)}`,
    languageName: localeNames[locale],
    ogLocale: ogLocales[locale],
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
      if (key === 'jsonExample') return jsonExample
      if (key === 'ogAlternateLocales')
        return locales
          .filter((language) => language !== locale)
          .map(
            (language) => `<meta property="og:locale:alternate" content="${ogLocales[language]}">`,
          )
          .join('\n')
      if (key === 'softwareApplication')
        return JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Nesso',
          description: t('metaDescription'),
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'macOS, Windows, Linux',
          softwareVersion: version,
          license: 'https://opensource.org/licenses/MIT',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          url: page.pageUrl,
          downloadUrl: (['macOS', 'Windows', 'Linux'] as const).map(
            (platform) => desktopDownload(platform, version)!.href,
          ),
        }).replaceAll('<', '\\u003c')
      if (key in page) return escapeHtml(page[key as keyof typeof page])
      return escapeHtml(t(key as keyof typeof en, { version, platform: '{platform}' }))
    })
}

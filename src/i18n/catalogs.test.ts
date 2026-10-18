import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { locales, type Catalog, type Locale } from '@nesso/i18n'
import { parsePluginI18n } from '@nesso/plugin/runtime'

const placeholders = (message: string) => [...message.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
const pluralSuffix = /_(zero|one|two|few|many|other)$/
const readCatalog = (source: string, locale: Locale): Catalog => {
  if (!source.endsWith('package.json')) return JSON.parse(readFileSync(new URL(`${source}/${locale}.json`, import.meta.url), 'utf8'))
  const catalog = parsePluginI18n(JSON.parse(readFileSync(new URL(source, import.meta.url), 'utf8')).i18n)
  const messages = Object.entries(catalog).flatMap(([key, value]) => 'en' in value ? [[key, value[locale]]] : Object.entries(value).map(([field, text]) => [`${key}.${field}`, text[locale]]))
  return Object.fromEntries(messages.map(([key, message]) => {
    assert.equal(typeof message, 'string', `${source}:${locale}:${key}`)
    return [key, message]
  }))
}

test('intro descriptions have balanced, nonempty keyword emphasis in every locale', () => {
  for (const locale of locales) {
    const catalog: Catalog = JSON.parse(readFileSync(new URL(`./${locale}.json`, import.meta.url), 'utf8'))
    for (const key of ['introConceptDescription', 'introConnectionsDescription', 'introUnderstandingDescription', 'introUnderstandingDesktopDescription']) {
      const parts = catalog[key].split('**')
      assert.ok(parts.length > 1, `${locale}:${key}`)
      assert.equal(parts.length % 2, 1, `${locale}:${key}`)
      assert.ok(parts.filter((_, index) => index % 2).every((part) => part.trim()), `${locale}:${key}`)
    }
  }
})

test('UI catalogs cover the host, site and bundled plugin interfaces in all supported locales with matching placeholders', () => {
  for (const directory of [
    '.',
    '../../site/i18n',
    '../../packages/concept-map/src/i18n',
    '../../plugins/export/package.json',
    '../../plugins/import/package.json',
    '../../plugins/base-vocab/package.json',
    '../../plugins/kernel/package.json',
  ]) {
    const english = readCatalog(directory, 'en')
    const keys = [...new Set(Object.keys(english).map((key) => key.replace(pluralSuffix, '')))]
    for (const locale of locales) {
      const catalog = locale === 'en' ? english : readCatalog(directory, locale)
      const pluralForms = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
      const expectedKeys = keys.flatMap((key) => english[`${key}_other`] === undefined ? [key] : pluralForms.map((form) => `${key}_${form}`))
      assert.deepEqual(Object.keys(catalog).sort(), expectedKeys.sort(), `${directory}:${locale}`)
      for (const [key, message] of Object.entries(catalog)) {
        const reference = english[key] ?? english[key.replace(pluralSuffix, '_other')]
        assert.ok(message.trim(), `${directory}:${locale}:${key}`)
        assert.deepEqual(placeholders(message), placeholders(reference), `${directory}:${locale}:${key}`)
      }
    }
  }
})

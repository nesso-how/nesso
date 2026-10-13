import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { locales, type Catalog } from '@nesso/i18n'

const placeholders = (message: string) => [...message.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
const pluralSuffix = /_(zero|one|two|few|many|other)$/

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

test('catalogs cover the host, site and every built-in plugin in all supported locales with matching placeholders', () => {
  for (const directory of [
    '.',
    '../../site/i18n',
    '../../plugins/base-vocab/src/i18n',
    '../../plugins/concept-map/src/i18n',
    '../../plugins/export/src/i18n',
    '../../plugins/import/src/i18n',
    '../../plugins/kernel/src/i18n',
  ]) {
    const english: Catalog = JSON.parse(readFileSync(new URL(`${directory}/en.json`, import.meta.url), 'utf8'))
    const keys = [...new Set(Object.keys(english).map((key) => key.replace(pluralSuffix, '')))]
    for (const locale of locales) {
      const catalog: Catalog = locale === 'en' ? english : JSON.parse(readFileSync(new URL(`${directory}/${locale}.json`, import.meta.url), 'utf8'))
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

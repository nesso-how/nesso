import assert from 'node:assert/strict'
import test from 'node:test'
import { createTranslator, detectLocale, I18nError } from './index.ts'

const translate = createTranslator({
  greeting: 'Hello, {{name}}',
  fallback: 'English fallback',
  count_one: '{{count}} concept',
  count_other: '{{count}} concepts',
}, {
  it: {
    greeting: 'Ciao, {{name}}',
    count_one: '{{count}} concetto',
    count_many: '{{count}} concetti',
    count_other: '{{count}} concetti',
  },
  'zh-CN': {
    count_other: '{{count}} 个概念',
  },
})

test('locale detection follows language preference order, matches regional variants and falls back to English', () => {
  for (const [languages, expected] of [
    [[], 'en'],
    [['fr-FR'], 'en'],
    [['en-GB', 'it-IT'], 'en'],
    [['it-CH', 'en-US'], 'it'],
    [['fr-FR', 'it-IT'], 'it'],
  ] as const) assert.equal(detectLocale(languages), expected, languages.join(', '))
})

test('locale detection recognizes Simplified Chinese without treating Traditional Chinese as Simplified', () => {
  for (const language of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-TW']) {
    assert.equal(detectLocale([language]), 'zh-CN', language)
  }
  for (const language of ['zh-TW', 'zh-HK', 'zh-Hant', 'zh-Hant-CN']) {
    assert.equal(detectLocale([language]), 'en', language)
  }
  assert.equal(detectLocale(['zh-Hant', 'it-IT']), 'it')
})

test('isolated translators handle interpolation, English fallback and native plurals', () => {
  const t = translate('it')
  assert.equal(translate('en')('greeting', { name: 'Omar' }), 'Hello, Omar')
  assert.equal(t('greeting', { name: 'Omar' }), 'Ciao, Omar')
  assert.equal(t('fallback'), 'English fallback')
  assert.equal(t('count', { count: 1 }), '1 concetto')
  assert.equal(t('count', { count: 2 }), '2 concetti')
  assert.equal(t('count', { count: 1_000_000 }), '1000000 concetti')
  assert.equal(t('greeting', { name: '<strong>{{name}}</strong>' }), 'Ciao, <strong>{{name}}</strong>')
  assert.equal(createTranslator({ greeting: 'Different catalog' })('it')('greeting'), 'Different catalog')
  assert.equal(t('greeting', { name: 'Omar' }), 'Ciao, Omar')
})

test('Simplified Chinese uses the same plural form for every count', () => {
  const t = translate('zh-CN')
  for (const count of [0, 1, 2]) assert.equal(t('count', { count }), `${count} 个概念`)
})

test('unknown keys, missing interpolation values and invalid counts throw structured errors', () => {
  const t = translate('en')
  assert.throws(() => t('greeting'), (error: unknown) => error instanceof I18nError && error.issues[0].path === 'greeting.name')
  assert.throws(() => t('count', { count: NaN }), (error: unknown) => error instanceof I18nError && error.issues[0].path === 'count.count')
  assert.throws(() => t('unknown' as never), (error: unknown) => error instanceof I18nError && error.issues[0].path === 'unknown')
})

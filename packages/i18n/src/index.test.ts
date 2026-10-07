import assert from 'node:assert/strict'
import test from 'node:test'
import { createTranslator, I18nError } from './index.ts'

const translate = createTranslator({
  greeting: 'Hello, {name}',
  fallback: 'English fallback',
  count: { one: '{count} concept', other: '{count} concepts' },
}, {
  it: {
    greeting: 'Ciao, {name}',
    count: { one: '{count} concetto', other: '{count} concetti' },
  },
})

test('translates messages with interpolation, English fallback and plurals', () => {
  const t = translate('it')
  assert.equal(translate('en')('greeting', { name: 'Omar' }), 'Hello, Omar')
  assert.equal(t('greeting', { name: 'Omar' }), 'Ciao, Omar')
  assert.equal(t('fallback'), 'English fallback')
  assert.equal(t('count', { count: 1 }), '1 concetto')
  assert.equal(t('count', { count: 2 }), '2 concetti')
})

test('missing interpolation values and invalid plural counts have structured package errors', () => {
  const t = translate('en')
  assert.throws(() => t('greeting'), (error: unknown) => error instanceof I18nError && error.issues[0].path === 'greeting.name')
  assert.throws(() => t('count', { count: NaN }), (error: unknown) => error instanceof I18nError && error.issues[0].path === 'count.count')
})

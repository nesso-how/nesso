import assert from 'node:assert/strict'
import { test } from 'node:test'
import { locales } from '@nesso-how/i18n'
import { messages } from './i18n.ts'

test('review translations cover every supported locale with nonempty messages', () => {
  assert.deepEqual(Object.keys(messages).sort(), [...locales].sort())
  const keys = Object.keys(messages.en).sort()
  for (const locale of locales) {
    const catalog = messages[locale]
    assert.deepEqual(Object.keys(catalog).sort(), keys, locale)
    assert.ok(
      Object.values(catalog).every((text) => text.trim()),
      locale,
    )
  }
})

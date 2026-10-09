import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { kernelPlugin } from '../src/index.ts'

test('the theme plugin contributes an identity matching its stylesheet without accessing the store', () => {
  assert.ok(kernelPlugin.kind === 'theme')
  const definition = kernelPlugin.create({
    get store() {
      return assert.fail('Theme definitions must not access the store')
    },
    get notifications() {
      return assert.fail('Theme definitions must not access notifications')
    },
  })
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.ok(css.includes(`:root[data-theme='${definition.id}']`))
})

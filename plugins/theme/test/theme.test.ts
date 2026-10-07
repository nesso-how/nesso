import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { themePlugin } from '../src/index.ts'

test('the theme plugin contributes an identity matching its stylesheet without accessing the store', () => {
  assert.ok(themePlugin.kind === 'theme')
  const definition = themePlugin.create({
    get store() {
      assert.fail('Theme definitions must not access the store')
    },
  })
  assert.deepEqual(definition, { id: 'kernel', label: 'Kernel' })
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.ok(css.includes(`:root[data-theme='${definition.id}']`))
})

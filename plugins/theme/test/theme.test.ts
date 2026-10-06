import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { themePlugin } from '../src/index.ts'

test('the theme plugin contributes an identity matching its stylesheet without accessing the store', () => {
  const definition = themePlugin({
    get store() {
      assert.fail('Theme definitions must not access the store')
    },
  })
  assert.deepEqual(definition.themes, [{ id: 'kernel', label: 'Kernel' }])
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  for (const theme of definition.themes ?? []) {
    assert.ok(css.includes(`:root[data-theme='${theme.id}']`))
  }
})

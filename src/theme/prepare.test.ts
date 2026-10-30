import assert from 'node:assert/strict'
import test from 'node:test'
import type { ThemeDefinition } from '@nesso-how/plugin'
import { prepareTheme } from './prepare.ts'
import theme from '../../packages/plugin/test/theme.json' with { type: 'json' }

test('theme preparation owns units, scoped families and generated font CSS using only admitted bytes', async () => {
  const fallback = await prepareTheme(theme, new Map())
  assert.equal(fallback.tokens['font-sans'], 'system-ui, sans-serif')
  assert.equal(fallback.tokens['radius-control'], '3px')
  assert.equal(fallback.tokens['duration-state'], '140ms')
  assert.equal(fallback.fontStyles, '')
  const definition: ThemeDefinition = {
    ...theme,
    fonts: {
      ...theme.fonts,
      sans: {
        faces: [
          {
            path: 'fonts/example.woff2',
            weight: [100, 900],
            style: 'normal',
            unicodeRange: [[0, 255]],
          },
        ],
      },
    },
  }
  const assets = new Map([['fonts/example.woff2', new TextEncoder().encode('wOF2font')]])
  const prepared = await prepareTheme(definition, assets)
  assert.match(prepared.tokens['font-sans'], /^"nesso-[a-f0-9]{64}-sans", system-ui, sans-serif$/)
  assert.match(prepared.fontStyles, /src:url\(data:font\/woff2;base64,/)
  assert.match(prepared.fontStyles, /unicode-range:U\+0-ff;/)
  assets.set('fonts/example.woff2', new TextEncoder().encode('wOF2different'))
  assert.notEqual(
    (await prepareTheme(definition, assets)).tokens['font-sans'],
    prepared.tokens['font-sans'],
  )
  await assert.rejects(prepareTheme(definition, new Map()), { code: 'invalid-input' })
  await assert.rejects(
    prepareTheme(
      definition,
      new Map([['fonts/example.woff2', new Uint8Array(4 * 1024 * 1024 + 1)]]),
    ),
    { code: 'invalid-input' },
  )
})

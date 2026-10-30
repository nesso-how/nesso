import assert from 'node:assert/strict'
import test from 'node:test'
import { parseContribution, parseDefinition, PluginError } from '../src/runtime.ts'
import theme from './theme.json' with { type: 'json' }

test('theme definitions reject CSS authority, dark surfaces, unreadable text and invalid font descriptors', () => {
  assert.deepEqual(parseDefinition('theme', theme), theme)
  for (const value of [
    { ...theme, css: 'body{}' },
    { ...theme, colors: { ...theme.colors, canvas: 'var(--background)' } },
    { ...theme, colors: { ...theme.colors, sidebar: '#ffffff00' } },
    { ...theme, colors: { ...theme.colors, background: '#000000' } },
    { ...theme, colors: { ...theme.colors, foreground: '#eeeeee' } },
    { ...theme, metrics: { ...theme.metrics, 'duration-state': 301 } },
    {
      ...theme,
      fonts: {
        ...theme.fonts,
        sans: { faces: [{ path: '../private.woff2', weight: [400, 400], style: 'normal' }] },
      },
    },
    {
      ...theme,
      fonts: {
        ...theme.fonts,
        sans: { faces: [{ path: 'fonts/font.woff2', weight: [900, 100], style: 'normal' }] },
      },
    },
    {
      ...theme,
      fonts: {
        ...theme.fonts,
        sans: {
          faces: [
            {
              path: 'fonts/font.woff2',
              weight: [400, 400],
              style: 'normal',
              unicodeRange: [[100, 10]],
            },
          ],
        },
      },
    },
  ])
    assert.throws(() => parseContribution('theme', value), PluginError)
})

test('vocabularies retain absolute stable IRIs and reject duplicate types, unknown defaults and extra fields', () => {
  const definition = {
    id: 'example',
    relationTypes: [{ id: 'urn:nesso:related', label: 'Related' }],
    defaultTypeId: 'urn:nesso:related',
  }
  assert.deepEqual(parseDefinition('vocab', definition), definition)
  for (const value of [
    { ...definition, relationTypes: [...definition.relationTypes, ...definition.relationTypes] },
    {
      ...definition,
      relationTypes: [{ id: 'relative', label: 'Related' }],
      defaultTypeId: 'relative',
    },
    { ...definition, defaultTypeId: 'urn:nesso:unknown' },
    { ...definition, run: true },
  ])
    assert.throws(() => parseContribution('vocab', value), PluginError)
})

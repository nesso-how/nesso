import assert from 'node:assert/strict'
import test from 'node:test'
import { parseContribution, parseDefinition, PluginError } from '../src/runtime.ts'
import theme from './theme.json' with { type: 'json' }

test('theme definitions reject CSS authority, dark surfaces, unreadable text and plugin fonts', () => {
  assert.deepEqual(parseDefinition('theme', theme), theme)
  for (const value of [
    { ...theme, css: 'body{}' },
    { ...theme, colors: { ...theme.colors, canvas: 'var(--background)' } },
    { ...theme, colors: { ...theme.colors, sidebar: '#ffffff00' } },
    { ...theme, colors: { ...theme.colors, background: '#000000' } },
    { ...theme, colors: { ...theme.colors, foreground: '#eeeeee' } },
    { ...theme, metrics: { ...theme.metrics, 'duration-state': 301 } },
    { ...theme, fonts: { sans: { faces: [] }, mono: { faces: [] } } },
    { ...theme, metrics: { ...theme.metrics, 'font-sans': 'Other' } },
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

test('vocabulary translations accept supported locales and reject invalid or oversized labels', () => {
  const definition = {
    id: 'example',
    relationTypes: [
      {
        id: 'urn:part',
        label: 'partOf',
        translations: { en: 'is part of', it: 'è parte di', 'zh-CN': '是其一部分' },
      },
    ],
    defaultTypeId: 'urn:part',
  }
  assert.deepEqual(parseDefinition('vocab', definition), definition)
  for (const translations of [{ fr: 'fait partie de' }, { it: '   ' }, { it: 'a'.repeat(31) }])
    assert.throws(
      () =>
        parseDefinition('vocab', {
          ...definition,
          relationTypes: [{ ...definition.relationTypes[0], translations }],
        }),
      PluginError,
    )
})

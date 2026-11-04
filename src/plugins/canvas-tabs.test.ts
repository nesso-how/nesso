import assert from 'node:assert/strict'
import test from 'node:test'
import { canvasTabs, visibleTabs } from './canvas-tabs.ts'
import type { PluginEntry } from './registry.ts'

const plugin = (
  id: string,
  actions: readonly { id: string; ui?: true }[],
  state: Pick<PluginEntry, 'disabled' | 'error'> = {},
): PluginEntry => ({
  id,
  version: '1.0.0',
  kind: 'actions',
  i18n: {
    metadata: {
      name: { en: id },
      description: { en: id },
      documentation: { en: id },
    },
  },
  ...state,
  contribution: actions.map((action) => ({ ...action, label: { en: action.id } })),
})

test('canvas tabs list ui actions in stored order, skip unavailable plugins and append unseen tabs', () => {
  const order = ['notes:notes', 'quiz:quiz', 'review:review']
  const plugins = [
    plugin('io', [{ id: 'export' }]),
    plugin('review', [{ id: 'review', ui: true }]),
    plugin('map', [{ id: 'map', ui: true }]),
    plugin('notes', [{ id: 'notes', ui: true }]),
    plugin('quiz', [{ id: 'quiz', ui: true }], { disabled: true }),
    plugin('broken', [{ id: 'broken', ui: true }], { error: 'Unavailable' }),
  ]
  const keys = (entries: readonly PluginEntry[]) => canvasTabs(entries, order).map(({ key }) => key)
  assert.deepEqual(keys(plugins), ['notes:notes', 'review:review', 'map:map'])
  plugins[4] = plugin('quiz', [{ id: 'quiz', ui: true }])
  assert.deepEqual(keys(plugins), ['notes:notes', 'quiz:quiz', 'review:review', 'map:map'])
  assert.deepEqual(
    canvasTabs(plugins).map(({ id }) => id),
    ['review', 'map', 'notes', 'quiz'],
  )
})

test('tab overflow hides trailing tabs and keeps the active tab in the last visible slot', () => {
  const tabs = ['a', 'b', 'c', 'd', 'e']
  const layout = { available: 300, gap: 4, fixed: 70, more: 30, tabs: [50, 50, 50, 50, 50] }
  assert.deepEqual(visibleTabs(tabs, -1, null), tabs)
  assert.deepEqual(visibleTabs(tabs, -1, { ...layout, tabs: [50] }), tabs)
  assert.deepEqual(visibleTabs(tabs, 2, { ...layout, available: 340 }), tabs)
  assert.deepEqual(visibleTabs(tabs, -1, layout), ['a', 'b', 'c'])
  assert.deepEqual(visibleTabs(tabs, 1, layout), ['a', 'b', 'c'])
  assert.deepEqual(visibleTabs(tabs, 4, layout), ['a', 'b', 'e'])
  assert.deepEqual(visibleTabs(tabs, 4, { ...layout, tabs: [50, 50, 50, 50, 120] }), ['a', 'e'])
  assert.deepEqual(visibleTabs(tabs, 3, { ...layout, available: 100 }), ['d'])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareTheme } from './prepare.ts'
import theme from '../../packages/plugin/test/theme.json' with { type: 'json' }

test('theme preparation supplies each palette with shared metric units without controlling typography', () => {
  const { tokens } = prepareTheme(theme)
  for (const scheme of ['light', 'dark'] as const) {
    assert.equal(tokens[scheme].background, theme.colors[scheme].background)
    assert.equal(tokens[scheme]['radius-control'], '3px')
    assert.equal(tokens[scheme]['radius-object'], '4px')
    assert.equal(tokens[scheme]['duration-state'], '140ms')
    assert.equal('font-sans' in tokens[scheme], false)
    assert.equal('font-mono' in tokens[scheme], false)
  }
})

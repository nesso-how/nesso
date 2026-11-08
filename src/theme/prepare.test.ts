import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareTheme } from './prepare.ts'
import theme from '../../packages/plugin/test/theme.json' with { type: 'json' }

test('theme preparation supplies colors and metric units without controlling typography', () => {
  const { tokens } = prepareTheme(theme)
  assert.equal(tokens.background, theme.colors.background)
  assert.equal(tokens['radius-control'], '3px')
  assert.equal(tokens['radius-object'], '4px')
  assert.equal(tokens['duration-state'], '140ms')
  assert.equal('font-sans' in tokens, false)
  assert.equal('font-mono' in tokens, false)
})

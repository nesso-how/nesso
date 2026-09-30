import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from './store/create.ts'
import { connectTheme } from './theme.ts'

test('the host applies the active theme immediately to the page root', () => {
  const host = createNessoStore(null)
  host.registerTheme({ id: 'light', label: 'Light' })
  const applied: string[][] = []
  const disconnect = connectTheme(host, { setAttribute: (name, value) => applied.push([name, value]) })
  assert.deepEqual(applied, [['data-theme', 'light']])
  disconnect()
})

test('the host applies only registered themes, tracks changes, and disconnects cleanly', () => {
  const host = createNessoStore(null)
  const applied: string[][] = []
  const disconnect = connectTheme(host, { setAttribute: (name, value) => applied.push([name, value]) })
  assert.deepEqual(applied, [])
  host.registerTheme({ id: 'light', label: 'Light' })
  assert.deepEqual(applied, [['data-theme', 'light']])
  host.registerTheme({ id: 'alternative', label: 'Alternative' })
  host.ui.setActiveTheme('light')
  host.store.setConceptLabel(host.store.getState().workspace.focusId, 'Renamed')
  assert.equal(applied.length, 1)
  host.ui.setActiveTheme('alternative')
  assert.deepEqual(applied, [['data-theme', 'light'], ['data-theme', 'alternative']])
  disconnect()
  host.ui.setActiveTheme('light')
  assert.equal(applied.length, 2)
})

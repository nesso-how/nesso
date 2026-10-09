import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from '../store/create.ts'
import { connectTheme } from './index.ts'

test('the host applies only registered themes, tracks changes, and disconnects cleanly', () => {
  for (const registered of [false, true]) {
    const host = createNessoStore(null)
    const theme = { id: 'light' }
    if (registered) host.registerTheme(theme)
    const applied: string[][] = []
    const disconnect = connectTheme(host, { setAttribute: (name, value) => applied.push([name, value]) })
    assert.deepEqual(applied, registered ? [['data-theme', 'light']] : [])
    if (!registered) host.registerTheme(theme)
    assert.deepEqual(applied, [['data-theme', 'light']])
    host.registerTheme({ id: 'alternative' })
    host.store.setActiveTheme('light')
    host.store.setConceptLabel(host.store.getState().graph.concepts[0].id, 'Renamed')
    assert.equal(applied.length, 1)
    host.store.setActiveTheme('alternative')
    assert.deepEqual(applied, [['data-theme', 'light'], ['data-theme', 'alternative']])
    disconnect()
    host.store.setActiveTheme('light')
    assert.equal(applied.length, 2)
  }
})

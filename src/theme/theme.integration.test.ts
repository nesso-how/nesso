import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from '../store/create.ts'
import { connectTheme } from './index.ts'
import themeFixture from '../../packages/plugin/test/theme.json' with { type: 'json' }

test('the host applies only registered themes, tracks changes, and disconnects cleanly', () => {
  for (const registered of [false, true]) {
    const host = createNessoStore(null)
    const theme = themeFixture
    if (registered) host.registerTheme(theme)
    const applied: string[] = []
    const disconnect = connectTheme(host, (definition) => applied.push(definition.id))
    assert.deepEqual(applied, registered ? ['light'] : [])
    if (!registered) host.registerTheme(theme)
    assert.deepEqual(applied, ['light'])
    host.registerTheme({ ...themeFixture, id: 'alternative' })
    host.store.setActiveTheme('light')
    host.store.setConceptLabel(host.store.getState().graph.concepts[0].id, 'Renamed')
    assert.equal(applied.length, 1)
    host.store.setActiveTheme('alternative')
    assert.deepEqual(applied, ['light', 'alternative'])
    host.replacePluginDefinitions([{ ...themeFixture, id: 'alternative', metrics: { ...themeFixture.metrics, 'radius-control': 8 } }, themeFixture])
    assert.deepEqual(applied, ['light', 'alternative', 'alternative'])
    assert.equal(host.getTheme('alternative')!.metrics['radius-control'], 8)
    disconnect()
    host.store.setActiveTheme('light')
    assert.equal(applied.length, 3)
  }
})

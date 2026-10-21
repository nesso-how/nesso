import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMessageSize, parseContribution, parsePluginI18n, parsePluginManifest, parsePluginMessage, PluginError, resolvePluginText } from '../src/runtime.ts'

const manifest = {
  apiVersion: 1, kind: 'actions', entry: 'dist/index.js',
  writes: ['selection.set'], capabilities: [],
}

test('manifests and action descriptors reject unknown authority, duplicates and oversized labels', () => {
  assert.equal(parsePluginManifest(manifest).kind, 'actions')
  assert.deepEqual(parsePluginManifest({ ...manifest, capabilities: ['files.open', 'files.save', 'notifications.notify'] }).capabilities, ['files.open', 'files.save', 'notifications.notify'])
  assert.deepEqual(parsePluginManifest({ ...manifest, writes: ['concept.label', 'concept.description', 'concept.color', 'concept.position', 'concept.positions', 'concept.add', 'concept.remove', 'relation.connect', 'relation.reconnect', 'relation.type', 'relation.type.create', 'relation.remove', 'selection.set', 'view.membership'] }).writes.length, 14)
  for (const value of [
    { ...manifest, apiVersion: 2 }, { ...manifest, network: true },
    { ...manifest, writes: ['selection.set', 'selection.set'] }, { ...manifest, operations: [] },
    { ...manifest, kind: 'renderer' }, { ...manifest, styles: [] }, { ...manifest, styles: ['dist/index.css'] },
    { ...manifest, writes: ['viewport.set'] }, { ...manifest, writes: ['preferences.renderer'] },
    { ...manifest, writes: ['document.reset'] }, { ...manifest, writes: ['history.undo'] }, { ...manifest, writes: ['history.redo'] },
    { ...manifest, writes: ['preferences.locale'] }, { ...manifest, writes: ['preferences.vocab'] }, { ...manifest, writes: ['preferences.theme'] },
    { ...manifest, writes: ['preferences.panels'] }, { ...manifest, writes: ['preferences.section'] },
    { ...manifest, writes: ['view.create'] }, { ...manifest, writes: ['view.rename'] }, { ...manifest, writes: ['view.pin'] }, { ...manifest, writes: ['view.remove'] }, { ...manifest, writes: ['view.activate'] },
    { ...manifest, reads: [] },
    { ...manifest, capabilities: ['network'] },
    { ...manifest, capabilities: ['notifications.notify', 'notifications.notify'] },
    { ...manifest, capabilities: ['clipboard.read'] }, { ...manifest, capabilities: ['clipboard.write'] },
    { ...manifest, metadata: {} },
  ]) assert.throws(() => parsePluginManifest(value), PluginError)
  const descriptor = { id: 'example', label: { en: 'Example' }, supportsViews: true }
  assert.deepEqual(parseContribution('actions', [descriptor]), [descriptor])
  for (const value of [[], [descriptor, descriptor], [{ ...descriptor, run: true }]]) assert.throws(() => parseContribution('actions', value), PluginError)
  for (const kind of ['theme', 'vocab']) {
    const definition = { ...manifest, kind, entry: 'definition.json', writes: [] }
    assert.equal(parsePluginManifest(definition).kind, kind)
    for (const change of [{ entry: 'dist/index.js' }, { entry: 'definition.js' }, { reads: [] }, { writes: ['concept.add'] }, { capabilities: ['files.open'] }, { capabilities: ['notifications.notify'] }, { styles: [] }, { styles: ['dist/index.css'] }]) assert.throws(() => parsePluginManifest({ ...definition, ...change }), PluginError)
  }
  for (const entry of ['../index.js', 'dist/index.jsx', 'dist/index.ts']) assert.throws(() => parsePluginManifest({ ...manifest, entry }), PluginError)
})

test('package translations require localized metadata and admit only bounded plain-text runtime messages', () => {
  const metadata = { name: { en: 'Example', it: 'Esempio' }, description: { en: 'Description' }, documentation: { en: 'Documentation' } }
  const catalog = { metadata, action: { en: 'Run example', it: 'Esegui esempio' } }
  assert.deepEqual(parsePluginI18n(catalog), catalog)
  assert.equal(resolvePluginText(catalog.action, 'it'), 'Esegui esempio')
  assert.equal(resolvePluginText(catalog.action, 'zh-CN'), 'Run example')
  assert.equal(resolvePluginText(metadata.description, 'it'), 'Description')
  for (const value of [
    undefined, {}, { en: catalog }, { action: { en: 'Missing metadata' } },
    { ...catalog, action: { it: 'Missing English' } }, { ...catalog, action: { en: 'Action', fr: 'Unsupported' } },
    { ...catalog, action: 'Not localized' }, { ...catalog, action: { en: { text: 'Not plain text' } } },
    { ...catalog, metadata: { ...metadata, name: { en: '中'.repeat(100) } } },
    { ...catalog, metadata: { ...metadata, description: { en: '' } } },
    { ...catalog, metadata: { ...metadata, extra: true } },
    { ...catalog, action: { en: '中'.repeat(6000) } },
  ]) assert.throws(() => parsePluginI18n(value), PluginError)
})

test('messages reject non-data values, excessive nesting, unknown methods and extra identity fields', () => {
  for (const value of [new Date(), new Map(), () => {}]) assert.throws(() => checkMessageSize(value, 1024), PluginError)
  let nested: unknown = null
  for (let index = 0; index < 34; index++) nested = { nested }
  assert.throws(() => checkMessageSize(nested, 1024), PluginError)
  const request = { type: 'request', id: 1, contextId: 'context', method: 'store.refresh', params: {} }
  assert.equal(parsePluginMessage(request).type, 'request')
  for (const value of [{ ...request, pluginId: 'another' }, { ...request, method: 'host.setState' }, { ...request, id: Number.MAX_SAFE_INTEGER + 1 }]) assert.throws(() => parsePluginMessage(value), PluginError)
  assert.throws(() => parsePluginMessage({ ...request, method: 'store.applyOperations', params: { operations: [{ kind: 'concept.label', id: 'urn:nesso:probe', value: 42 }] } }), PluginError)
  for (const operation of [{ kind: 'viewport.set', rendererId: 'concept-map', value: { x: 0, y: 0, zoom: 1 } }, { kind: 'preferences.renderer', id: 'concept-map' }]) assert.throws(() => parsePluginMessage({ ...request, method: 'store.applyOperations', params: { operations: [operation] } }), PluginError)
  assert.throws(() => parsePluginMessage({ type: 'ready' }), PluginError)
  const notification = { ...request, method: 'notifications.notify', params: { tone: 'info', title: { en: 'Title', it: 'Titolo' }, description: { en: 'Description' } } }
  assert.equal(parsePluginMessage(notification).type, 'request')
  for (const title of ['Not localized', {}, { it: 'Missing English' }, { en: 'Title', 'zk-CN': 'Unsupported' }, { en: '中'.repeat(100) }]) assert.throws(() => parsePluginMessage({ ...notification, params: { ...notification.params, title } }), PluginError)
  const complete = { type: 'complete', ok: false, error: { code: 'failed', issues: [{ path: 'action', message: 'Diagnostic' }], displayMessage: { en: 'Failed', it: 'Operazione fallita' } } }
  assert.deepEqual(parsePluginMessage(complete), complete)
  for (const displayMessage of ['Not localized', { it: 'Missing English' }, { en: 'Failed', fr: 'Unsupported' }, { en: '中'.repeat(1000) }]) assert.throws(() => parsePluginMessage({ ...complete, error: { ...complete.error, displayMessage } }), PluginError)
})

test('plugin errors own bounded UTF-8 issues and never serialize oversized parser details', () => {
  const issues = Array.from({ length: 40 }, () => ({ path: '中'.repeat(300), message: '中'.repeat(3000) }))
  const error = new PluginError('invalid-input', issues, { en: '中'.repeat(3000), it: 'Errore' })
  assert.equal(error.issues.length, 32)
  assert.notEqual(error.issues, issues)
  assert.ok(error.issues.every(({ path, message }) => new TextEncoder().encode(path).byteLength <= 256 && new TextEncoder().encode(message).byteLength <= 2048))
  assert.equal(error.message, error.issues.map(({ path, message }) => `${path}: ${message}`).join('\n'))
  assert.ok(new TextEncoder().encode(error.displayMessage!.en).byteLength <= 2048)
  assert.equal(error.displayMessage!.it, 'Errore')
})

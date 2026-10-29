import assert from 'node:assert/strict'
import { once } from 'node:events'
import { parseGraph } from '@nesso-how/schema'
import { connectPlugins } from '../../electron/plugins.ts'
import { createTrustedRequest } from '../../electron/ipc.ts'
import type { PersistenceSection } from '../../shared/persistence.ts'
import { connectFixtureStorage, waitFor, type CheckContext } from './helpers.ts'

export async function verifyStorage({ window, url, name }: CheckContext) {
  const saved = name === 'desktop' ? connectFixtureStorage() : undefined
  if (saved) connectPlugins(createTrustedRequest(false))
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  const indexedDb = (section: PersistenceSection, writing: boolean, value?: unknown) => evaluate<unknown>(`new Promise((resolve,reject)=>{
    const opened=indexedDB.open('nesso',1);
    opened.onerror=()=>reject(opened.error);
    opened.onsuccess=()=>{
      const db=opened.result;
      const tx=db.transaction('records',${JSON.stringify(writing ? 'readwrite' : 'readonly')});
      const records=tx.objectStore('records');
      const request=${writing ? `records.put(${JSON.stringify(value)},${JSON.stringify(section)})` : `records.get(${JSON.stringify(section)})`};
      tx.oncomplete=()=>{db.close();resolve(${writing ? 'null' : 'request.result'})};
      tx.onabort=()=>{db.close();reject(tx.error)};
    };
  })`)
  const read = async (section: PersistenceSection) => saved ? saved.get(section) : indexedDb(section, false)
  const write = async (section: PersistenceSection, value: unknown) => { if (saved) saved.set(section, value); else await indexedDb(section, true, value) }
  const reload = async () => {
    const loaded = once(window.webContents, 'did-finish-load')
    window.reload()
    await loaded
    await waitFor(() => evaluate<boolean>(`!!document.querySelector('#canvas .react-flow')`), Boolean)
  }
  await window.loadURL(url)
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('.intro')`), Boolean)
  await evaluate(`document.querySelector('.intro-header button').click()`)
  await waitFor(async () => !!(await read('preferences') as { preferences?: { introSeen?: boolean } } | undefined)?.preferences?.introSeen, Boolean)
  const document = await waitFor(async () => await read('document') as { documentId: string; graph: unknown } | undefined, Boolean)
  assert.ok(document)
  const conceptId = parseGraph(document.graph).concepts[0].id
  await write('plugin-storage', { version: 1, documentId: document.documentId, plugins: [{
    pluginId: 'nesso-plugin-not-installed', revision: 1, records: [
      { key: 'settings', value: { enabled: true } },
      { key: 'progress', conceptId, value: 'live' },
      { key: 'progress', conceptId: 'urn:missing', value: 'orphan' },
    ],
  }] })
  await reload()
  const cleaned = await waitFor(async () => await read('plugin-storage') as { plugins: { records: { conceptId?: string }[] }[] }, (value) => value.plugins[0].records.length === 2)
  assert.deepEqual(cleaned.plugins[0].records.map((record) => record.conceptId), [undefined, conceptId])
  const restored = await read('document') as typeof document
  assert.equal(restored.documentId, document.documentId)
  assert.deepEqual(restored.graph, document.graph)
  await write('plugin-storage', 'unreadable')
  await reload()
  await waitFor(() => evaluate<boolean>(`document.body.textContent.includes('plugin-storage')`), Boolean)
  assert.equal(await read('plugin-storage'), 'unreadable')
  const protectedDocument = await read('document') as typeof document
  assert.equal(protectedDocument.documentId, document.documentId)
  assert.deepEqual(protectedDocument.graph, document.graph)
  console.log(`${name}: plugin data restored, concept orphans cleaned without a plugin, and unreadable storage visibly protected`)
}

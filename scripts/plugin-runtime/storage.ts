import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { WorkspaceState } from '@nesso-how/core'
import { parseGraph } from '@nesso-how/schema'
import { connectPlugins } from '../../electron/plugins.ts'
import { appUrl, createTrustedRequest } from '../../electron/ipc.ts'
import type { PersistenceSection } from '../../shared/persistence.ts'
import { persistenceSections } from '../../shared/persistence.ts'
import type { Backup } from '../../shared/backup.ts'
import { connectFixtureStorage, waitFor, type CheckContext } from './helpers.ts'

export async function verifyStorage({ window, url, name }: CheckContext) {
  const saved = name === 'desktop' ? connectFixtureStorage() : undefined
  if (saved) connectPlugins(createTrustedRequest(appUrl(false)))
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  const indexedDb = (section: PersistenceSection, writing: boolean, value?: unknown) =>
    evaluate<unknown>(`new Promise((resolve,reject)=>{
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
  const read = async (section: PersistenceSection) =>
    saved ? saved.get(section) : indexedDb(section, false)
  const write = async (section: PersistenceSection, value: unknown) => {
    if (saved) saved.set(section, value)
    else await indexedDb(section, true, value)
  }
  const reload = async () => {
    const loaded = once(window.webContents, 'did-finish-load')
    window.reload()
    await loaded
    await waitFor(
      () => evaluate<boolean>(`!!document.querySelector('#canvas .react-flow')`),
      Boolean,
    )
  }
  await window.loadURL(url)
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('.intro')`), Boolean)
  await evaluate(`document.querySelector('.intro-skip').click()`)
  await waitFor(
    async () =>
      !!((await read('preferences')) as { preferences?: { introSeen?: boolean } } | undefined)
        ?.preferences?.introSeen,
    Boolean,
  )
  const document = await waitFor(
    async () =>
      (await read('document')) as
        | {
            documentId: string
            graph: { schemaVersion: number; '@graph': { '@id': string }[] }
            workspace: WorkspaceState
          }
        | undefined,
    Boolean,
  )
  assert.ok(document)
  const conceptId = parseGraph(document.graph).graph.concepts[0].id
  await write('plugin-storage', {
    version: 1,
    documentId: document.documentId,
    plugins: [
      {
        pluginId: 'nesso-plugin-not-installed',
        revision: 1,
        records: [
          { key: 'settings', value: { enabled: true } },
          { key: 'progress', conceptId, value: 'live' },
          { key: 'progress', conceptId: 'urn:missing', value: 'orphan' },
        ],
      },
    ],
  })
  await reload()
  const preserved = await waitFor(
    async () =>
      (await read('plugin-storage')) as {
        version: number
        plugins: { local: boolean; records: { scope?: { id: string } }[] }[]
      },
    (value) => value.version === 3 && value.plugins[0].records.length === 3,
  )
  assert.equal(preserved.plugins[0].local, false)
  assert.deepEqual(
    preserved.plugins[0].records.map((record) => record.scope?.id),
    [undefined, conceptId, 'urn:missing'],
  )
  const restored = (await read('document')) as typeof document
  assert.equal(restored.documentId, document.documentId)
  assert.deepEqual(restored.graph, document.graph)
  await write('plugin-storage', 'unreadable')
  await reload()
  await waitFor(
    () => evaluate<boolean>(`document.body.textContent.includes('plugin-storage')`),
    Boolean,
  )
  assert.equal(await read('plugin-storage'), 'unreadable')
  const protectedDocument = (await read('document')) as typeof document
  assert.equal(protectedDocument.documentId, document.documentId)
  assert.deepEqual(protectedDocument.graph, document.graph)
  const presentation = new Map(
    document.workspace.savedViews.flatMap(({ members }) =>
      members.map(({ id, ...member }) => [id, member]),
    ),
  )
  const { schemaVersion: _, ...legacyGraph } = document.graph
  const legacy = {
    version: 1,
    graph: {
      ...legacyGraph,
      '@graph': document.graph['@graph'].map((node) => ({
        ...node,
        ...presentation.get(node['@id']),
      })),
    },
    workspace: {
      ...document.workspace,
      savedViews: document.workspace.savedViews.map(({ members, ...view }) => ({
        ...view,
        conceptIds: members.map(({ id }) => id),
      })),
    },
  }
  await write('plugin-storage', undefined)
  await write('document', legacy)
  const originalRecords = Object.fromEntries(
    await Promise.all(
      persistenceSections.map(async (section) => [section, (await read(section)) ?? null]),
    ),
  )
  await reload()
  const upgraded = await waitFor(
    async () =>
      (await read('document')) as {
        version: number
        documentId: string
        graph: unknown
        workspace: object
      },
    (value) => value.version === 3,
  )
  assert.deepEqual(upgraded.graph, document.graph)
  assert.deepEqual(
    { ...upgraded.workspace, viewports: document.workspace.viewports },
    document.workspace,
  )
  const backups = saved
    ? [...saved.entries()]
        .filter(([key]) => key.startsWith('backup:'))
        .map(([, value]) => value as Backup)
    : await evaluate<Backup[]>(`new Promise((resolve,reject)=>{
      const opened=indexedDB.open('nesso',1);
      opened.onerror=()=>reject(opened.error);
      opened.onsuccess=()=>{
        const db=opened.result;
        const tx=db.transaction('records','readonly');
        const records=tx.objectStore('records');
        const request=records.openCursor();
        const originals=[];
        request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(String(cursor.key).startsWith('backup:'))originals.push(cursor.value);cursor.continue()};
        tx.oncomplete=()=>{db.close();resolve(originals)};
        tx.onabort=()=>{db.close();reject(tx.error)};
      };
    })`)
  assert.equal(backups.length, 2)
  const documentBackup = backups.find(
    (backup) => (backup.records.document as { version: number }).version === 1,
  )
  assert.deepEqual(documentBackup?.records, originalRecords)
  const pluginBackup = backups.find(
    (backup) => (backup.records['plugin-storage'] as { version: number } | null)?.version === 1,
  )
  assert.ok(pluginBackup)
  assert.deepEqual(
    (
      pluginBackup.records['plugin-storage'] as {
        plugins: { records: { conceptId?: string }[] }[]
      }
    ).plugins[0].records.map(({ conceptId }) => conceptId),
    [undefined, conceptId, 'urn:missing'],
  )
  console.log(
    `${name}: plugin data preserved, unreadable storage protected, and document v1 upgraded with a complete backup`,
  )
}

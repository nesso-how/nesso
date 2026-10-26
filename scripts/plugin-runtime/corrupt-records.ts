import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import { app } from 'electron'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { connectPlugins } from '../../electron/plugins.ts'
import { createPluginStorage } from '../../electron/plugin-storage.ts'
import { createTrustedRequest } from '../../electron/ipc.ts'
import { preparePluginPackage } from '../../packages/plugin/src/package.ts'
import theme from '../../packages/plugin/test/theme.json' with { type: 'json' }
import { openFixtureWorkspace, waitFor, type CheckContext } from './helpers.ts'

export async function verifyCorruptRecords({ window, url }: CheckContext) {
  const directory = path.join(app.getPath('userData'), 'plugins')
  const storage = createPluginStorage(directory)
  for (const kind of ['actions', 'theme', 'vocab'] as const) {
    const entry = kind === 'actions' ? 'index.js' : 'definition.json'
    const content = kind === 'actions' ? 'export const create=()=>[{id:"restored-action",label:{en:"Restored action"},run(){}}]'
      : JSON.stringify(kind === 'theme' ? { ...theme, id: 'restored-theme' } : { id: 'restored-vocab', relationTypes: [{ id: 'urn:nesso:restored', label: 'Restored' }], defaultTypeId: 'urn:nesso:restored' })
    await storage.install(await preparePluginPackage({
      manifest: { name: `test-restored-${kind}`, version: '1.0.0', nesso: { apiVersion: 1, kind, entry, writes: [], capabilities: [] }, i18n: { metadata: { name: { en: `Restored ${kind}` }, description: { en: 'Restoration check' }, documentation: { en: 'Restoration check' } } } },
      files: [{ path: entry, bytes: new TextEncoder().encode(content) }],
    }), () => true)
  }
  const records = new Map(await Promise.all((await readdir(directory)).map(async (name) => [name, await readFile(path.join(directory, name))] as const)))
  connectPlugins(createTrustedRequest(false))
  const { saved, evaluate } = await openFixtureWorkspace({ window, url })
  const document = structuredClone(saved.get('document'))
  const corrupt = `${createHash('sha256').update('test-unreadable').digest('hex')}.json`
  await writeFile(path.join(directory, corrupt), '{')
  const reloaded = once(window.webContents, 'did-finish-load')
  window.reload()
  await reloaded
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('#canvas .react-flow')`), Boolean)
  await waitFor(() => evaluate<string>(`[...document.querySelectorAll('[data-slot="toast"][data-tone="warning"]')].map(toast => toast.textContent).join(' ')`), (text) => text.includes(corrupt) && text.includes('Some external plugins could not be loaded'))
  await evaluate(`document.querySelector('[data-settings-trigger]').click()`)
  await evaluate(`[...document.querySelectorAll('.settings-sidebar button')].find(button => button.textContent.trim() === 'Plugins').click()`)
  const rows = await evaluate<string[]>(`[...document.querySelectorAll('.plugin-row')].filter(row => row.getClientRects().length).map(row => row.innerText)`)
  assert.equal(rows.length, 7)
  for (const kind of ['actions', 'theme', 'vocab']) assert.ok(rows.some((text) => text.includes(`test-restored-${kind}`) && text.includes('Enabled')))
  assert.equal(await evaluate<boolean>(`window.nessoPlugins.remove(${JSON.stringify((await storage.list()).packages[0].contentId)}).then(result => 'issues' in result)`), true)
  await evaluate(`[...document.querySelectorAll('.plugin-row button')].find(button => button.textContent.includes('test-restored-actions')).click()`)
  await evaluate(`[...document.querySelectorAll('.plugin-detail-footer button')].find(button => button.textContent === 'Disable').click()`)
  await evaluate(`[...document.querySelectorAll('[role="dialog"][data-open]:not(.settings-popup) button')].find(button => button.textContent === 'Disable').click()`)
  await waitFor(() => evaluate<boolean>(`[...document.querySelectorAll('[data-slot="toast"]')].some(toast => toast.querySelector('.toast-title')?.textContent === 'Could not disable plugin' && toast.querySelector('.toast-description')?.textContent === 'Restored actions could not be disabled. Try again.')`), Boolean)
  await evaluate(`[...document.querySelectorAll('.plugin-detail-footer button')].find(button => button.textContent === 'Remove plugin').click()`)
  await evaluate(`[...document.querySelectorAll('[role="dialog"][data-open]:not(.settings-popup) button')].find(button => button.textContent === 'Remove plugin').click()`)
  await waitFor(() => evaluate<boolean>(`[...document.querySelectorAll('[data-slot="toast"]')].some(toast => toast.querySelector('.toast-title')?.textContent === 'Could not remove plugin' && toast.querySelector('.toast-description')?.textContent === 'Could not remove Restored actions from this device. Try again.')`), Boolean)
  assert.deepEqual(saved.get('document'), document)
  assert.equal(await readFile(path.join(directory, corrupt), 'utf8'), '{')
  for (const [name, bytes] of records) assert.deepEqual(await readFile(path.join(directory, name)), bytes)
  console.log('corrupt-records/desktop: valid actions, themes, and vocabularies restore with a visible warning and unchanged records/document')
}

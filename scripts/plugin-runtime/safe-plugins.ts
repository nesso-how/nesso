import assert from 'node:assert/strict'
import { app } from 'electron'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { connectPlugins } from '../../electron/plugins.ts'
import { createPluginStorage } from '../../electron/plugin-storage.ts'
import { createTrustedRequest } from '../../electron/ipc.ts'
import { preparePluginPackage } from '../../packages/plugin/src/package.ts'
import { openFixtureWorkspace, type CheckContext } from './helpers.ts'

export async function verifySafePlugins({ window, url }: CheckContext) {
  assert.ok(process.argv.includes('--safe-plugins'))
  const directory = path.join(app.getPath('userData'), 'plugins')
  const storage = createPluginStorage(directory)
  const prepared = await preparePluginPackage({
    manifest: { name: 'test-safe-plugins', version: '1.0.0', nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] }, i18n: { metadata: { name: { en: 'Safe mode probe' }, description: { en: 'Must not load' }, documentation: { en: 'Diagnostic startup check' } } } },
    files: [{ path: 'index.js', bytes: new TextEncoder().encode('throw new Error("External code must not run")') }],
  })
  const installed = await storage.install(prepared, () => true)
  const filename = path.join(directory, (await readdir(directory))[0])
  const before = await readFile(filename, 'utf8')
  connectPlugins(createTrustedRequest(false))
  const { saved, evaluate } = await openFixtureWorkspace({ window, url })
  const document = structuredClone(saved.get('document'))
  await evaluate(`document.querySelector('[data-settings-trigger]').click()`)
  await evaluate(`const plugins = [...document.querySelectorAll('.settings-sidebar button')].find(button => button.textContent.trim() === 'Plugins'); plugins.click()`)
  const text = await evaluate<string>(`document.querySelector('.plugin-settings').innerText`)
  assert.match(text, /External plugins are skipped for this session/)
  assert.equal(await evaluate<number>(`[...document.querySelectorAll('.plugin-row')].filter(row => row.getClientRects().length).length`), 5)
  assert.equal(await evaluate<boolean>(`!!document.querySelector('#plugin-search') || [...document.querySelectorAll('.plugin-tabs button')].some(button => button.textContent.includes('Find on npm'))`), false)
  assert.equal(await evaluate<number>(`document.querySelectorAll('[data-slot="toast"][data-tone="warning"]').length`), 0)
  assert.deepEqual(await evaluate(`window.nessoPlugins.list()`), { value: { safeMode: true, packages: [], issues: [] } })
  const blocked = await evaluate<boolean[]>(`Promise.all([
    window.nessoPlugins.search(''),
    window.nessoPlugins.latest(${JSON.stringify(prepared.name)}),
    window.nessoPlugins.installNpm(crypto.randomUUID(), {name:${JSON.stringify(prepared.name)},version:'1.1.0'}, 'en', ${JSON.stringify(installed.contentId)}),
    window.nessoPlugins.propose(crypto.randomUUID(), {}, 'en'),
    window.nessoPlugins.setEnabled(${JSON.stringify(installed.contentId)}, false),
    window.nessoPlugins.remove(${JSON.stringify(installed.contentId)})
  ]).then(results => results.map(result => 'issues' in result))`)
  assert.deepEqual(blocked, [true, true, true, true, true, true])
  assert.equal(await readFile(filename, 'utf8'), before)
  assert.deepEqual(await storage.list(), { packages: [installed], issues: [] })
  assert.deepEqual(saved.get('document'), document)
  console.log('safe-plugins/desktop: CLI flag skips external loading and blocks management without changing installed records')
}

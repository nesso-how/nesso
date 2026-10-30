import assert from 'node:assert/strict'
import { ipcMain } from 'electron'
import { build } from 'vite'
import { preparePluginPackage } from '../../packages/plugin/src/package.ts'
import source from '../../packages/plugin/example/package.json' with { type: 'json' }
import { openFixtureWorkspace, waitFor, type CheckContext } from './helpers.ts'

export async function verifyPanelWorkspace(context: CheckContext) {
  const output = await build({
    configFile: new URL('../../packages/plugin/example/vite.config.ts', import.meta.url).pathname,
    logLevel: 'silent', build: { write: false },
  })
  const bundle = Array.isArray(output) ? output[0] : output
  assert.ok('output' in bundle)
  const chunk = bundle.output.find((item) => item.type === 'chunk')
  assert.ok(chunk?.type === 'chunk')
  const prepared = await preparePluginPackage({ manifest: source, files: [{ path: source.nesso.entry, bytes: new TextEncoder().encode(chunk.code) }] })
  ipcMain.handle('plugins:list', () => ({ value: { safeMode: false, packages: [{ ...prepared, enabled: true }], issues: [] } }))
  const { evaluate, saved } = await openFixtureWorkspace(context)
  await evaluate(`document.querySelector('#canvas .react-flow').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  const open = async () => {
    await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Concept Quiz');if(!button)throw new Error('Missing example action');button.click()})()`)
    await waitFor(() => evaluate<boolean>(`!!document.querySelector('[data-plugin-panel] iframe') && getComputedStyle(document.querySelector('[data-plugin-panel] iframe')).visibility==='visible'`), Boolean)
  }
  await waitFor(() => evaluate<boolean>(`[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Concept Quiz')`), Boolean)
  await waitFor(async () => saved.get('document') as { workspace: { viewports: Record<string, unknown> } }, (record) => Object.keys(record?.workspace.viewports ?? {}).length > 0)
  const before = structuredClone(saved.get('document'))
  const progress = () => (saved.get('plugin-storage') as { plugins: { pluginId: string; records: { key: string; value: unknown }[] }[] } | undefined)?.plugins.find(({ pluginId }) => pluginId === source.name)?.records ?? []
  await evaluate(`window.__canvas=document.querySelector('#canvas .react-flow')`)
  await open()
  assert.equal(await evaluate(`document.querySelector('[data-plugin-panel] [aria-busy]').getAttribute('aria-busy')`), 'false')
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Return to graph')
  assert.equal(await evaluate(`document.querySelector('#canvas > div').hidden && document.querySelector('#canvas > div').inert`), true)
  const content = context.window.webContents.mainFrame.framesInSubtree.find((frame) => frame.url === 'about:srcdoc')!
  assert.ok(content)
  await waitFor(() => content.executeJavaScript(`document.querySelectorAll('.quiz button').length===2 && !document.querySelector('.quiz button').disabled`), Boolean)
  const firstQuestion = await content.executeJavaScript(`document.querySelector('[data-question]').textContent`)
  assert.ok(firstQuestion)
  assert.deepEqual(await content.executeJavaScript(`(()=>{const style=getComputedStyle(document.querySelector('.quiz button'));return {alignItems:style.alignItems,borderWidth:style.borderTopWidth}})()`), { alignItems: 'center', borderWidth: '1px' })
  assert.equal(await content.executeJavaScript(`getComputedStyle(document.querySelector('.quiz')).display`), 'grid')
  await content.executeJavaScript(`document.querySelector('.quiz button:last-child').click()`)
  await waitFor(() => content.executeJavaScript(`document.querySelector('[data-answer]').textContent.length>0`), Boolean)
  await content.executeJavaScript(`document.querySelector('.quiz button:last-child').click()`)
  await waitFor(() => content.executeJavaScript(`document.querySelector('[data-answer]')?.textContent==='' && document.querySelector('[data-question]')?.textContent.length>0`), Boolean)
  await waitFor(async () => progress().find(({ key }) => key === 'quiz:all')?.value, (value) => value === 1)
  const nextQuestion = await content.executeJavaScript(`document.querySelector('[data-question]').textContent`)
  await content.executeJavaScript(`document.querySelector('.quiz button:last-child').click()`)
  await waitFor(() => content.executeJavaScript(`document.querySelector('[data-answer]').textContent.length>0`), Boolean)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}))`)
  assert.equal(await evaluate(`document.querySelectorAll('#canvas .react-flow__node.selected').length`), 0)
  await evaluate(`document.querySelector('[data-plugin-panel] header button').click()`)
  await waitFor(() => evaluate<boolean>(`!document.querySelector('[data-plugin-panel]') && document.activeElement.closest('#canvas')!==null`), Boolean)
  assert.equal(await evaluate(`document.querySelector('#canvas .react-flow')===window.__canvas`), true)
  assert.deepEqual(saved.get('document'), before)
  await open()
  const frame = context.window.webContents.mainFrame.framesInSubtree.find((frame) => frame.url === 'about:srcdoc')!
  await waitFor(() => frame.executeJavaScript(`document.querySelectorAll('.quiz button').length===2 && !document.querySelector('.quiz button').disabled`), Boolean)
  assert.equal(await frame.executeJavaScript(`document.querySelector('[data-question]').textContent`), nextQuestion)
  assert.equal(await frame.executeJavaScript(`document.querySelector('[data-answer]').textContent`), '')
  await frame.executeJavaScript(`document.querySelector('.quiz button').click()`)
  await waitFor(async () => progress().find(({ key }) => key === 'quiz:all')?.value, (value) => value === 0)
  await waitFor(() => frame.executeJavaScript(`document.querySelector('.quiz button:last-child')?.textContent==='Show concept'`), Boolean)
  assert.equal(await frame.executeJavaScript(`document.querySelector('[data-question]').textContent`), firstQuestion)
  await frame.executeJavaScript(`void Promise.reject(new Error('Example request failed'))`)
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('[data-plugin-panel] [role="alert"]')`), Boolean)
  await evaluate(`document.querySelector('[data-plugin-panel] header button').click()`)
  await waitFor(() => evaluate<boolean>(`!document.querySelector('[data-plugin-panel]')`), Boolean)
  assert.deepEqual(saved.get('document'), before)
  console.log('desktop: standalone example discovered and opened through a view action; mounted canvas, focus restoration, shortcut suspension and crash recovery passed')
}

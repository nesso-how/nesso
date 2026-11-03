import assert from 'node:assert/strict'
import { ipcMain } from 'electron'
import { build } from 'vite'
import { preparePluginPackage } from '@nesso-how/plugin/package'
import source from '../../packages/plugin/example/package.json' with { type: 'json' }
import { openFixtureWorkspace, waitFor, type CheckContext } from './helpers.ts'

export async function verifyPanelWorkspace(context: CheckContext) {
  const output = await build({
    configFile: new URL('../../packages/plugin/example/vite.config.ts', import.meta.url).pathname,
    logLevel: 'silent',
    build: { write: false },
  })
  const bundle = Array.isArray(output) ? output[0] : output
  assert.ok('output' in bundle)
  const chunk = bundle.output.find((item) => item.type === 'chunk')
  assert.ok(chunk?.type === 'chunk')
  const prepared = await preparePluginPackage({
    manifest: source,
    files: [{ path: source.nesso.entry, bytes: new TextEncoder().encode(chunk.code) }],
  })
  ipcMain.handle('plugins:list', () => ({
    value: { safeMode: false, packages: [{ ...prepared, enabled: true }], issues: [] },
  }))
  const { evaluate, saved } = await openFixtureWorkspace(context)
  const assertShortcutsSuspended = async () => {
    await evaluate(
      `window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}))`,
    )
    assert.equal(
      await evaluate(`document.querySelectorAll('#canvas .react-flow__node.selected').length`),
      0,
    )
  }
  await evaluate(
    `document.querySelector('#canvas .react-flow').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
  )
  const open = async () => {
    await evaluate(`document.querySelector('#canvas header button[aria-haspopup="menu"]').click()`)
    await waitFor(
      () =>
        evaluate<boolean>(
          `[...document.querySelectorAll('[role="menuitem"]')].some(item=>item.textContent.trim()==='Concept Quiz')`,
        ),
      Boolean,
    )
    await evaluate(
      `[...document.querySelectorAll('[role="menuitem"]')].find(item=>item.textContent.trim()==='Concept Quiz').click()`,
    )
    await waitFor(
      () =>
        evaluate<boolean>(
          `!!document.querySelector('[data-plugin-panel] iframe') && getComputedStyle(document.querySelector('[data-plugin-panel] iframe')).visibility==='visible'`,
        ),
      Boolean,
    )
  }
  await waitFor(
    async () => saved.get('document') as { workspace: { viewports: Record<string, unknown> } },
    (record) => Object.keys(record?.workspace.viewports ?? {}).length > 0,
  )
  const before = structuredClone(saved.get('document'))
  const header = await evaluate<{ name: string; height: string }>(
    `(()=>{const header=document.querySelector('#canvas header');const trigger=header.querySelector('button[aria-haspopup="menu"]');return {name:trigger.getAttribute('aria-label').replace(/^Actions for /,''),height:getComputedStyle(header).height}})()`,
  )
  const progress = () =>
    (
      saved.get('plugin-storage') as
        | { plugins: { pluginId: string; records: { key: string; value: unknown }[] }[] }
        | undefined
    )?.plugins.find(({ pluginId }) => pluginId === source.name)?.records ?? []
  await evaluate(`window.__canvas=document.querySelector('#canvas .react-flow')`)
  await open()
  assert.deepEqual(
    await evaluate(
      `(()=>{const header=document.querySelector('[data-plugin-panel] header');return {name:header.querySelector('h2').textContent,action:header.querySelector('h2 + span').textContent,height:getComputedStyle(header).height}})()`,
    ),
    { ...header, action: 'Concept Quiz' },
  )
  assert.equal(
    await evaluate(
      `document.querySelector('[data-plugin-panel] [aria-busy]').getAttribute('aria-busy')`,
    ),
    'false',
  )
  assert.equal(
    await evaluate(`document.activeElement.getAttribute('aria-label')`),
    'Return to graph',
  )
  assert.equal(
    await evaluate(
      `!document.querySelector('#canvas .react-flow').checkVisibility() && document.querySelector('#canvas > div').inert`,
    ),
    true,
  )
  const content = context.window.webContents.mainFrame.framesInSubtree.find(
    (frame) => frame.url === 'about:srcdoc',
  )!
  assert.ok(content)
  await waitFor(
    () =>
      content.executeJavaScript(
        `document.querySelectorAll('.quiz button').length===2 && !document.querySelector('.quiz button').disabled`,
      ),
    Boolean,
  )
  const firstQuestion = await content.executeJavaScript(
    `document.querySelector('[data-question]').textContent`,
  )
  assert.ok(firstQuestion)
  assert.deepEqual(
    await content.executeJavaScript(
      `(()=>{const style=getComputedStyle(document.querySelector('.quiz button'));return {alignItems:style.alignItems,borderWidth:style.borderTopWidth}})()`,
    ),
    { alignItems: 'center', borderWidth: '1px' },
  )
  assert.equal(
    await content.executeJavaScript(`getComputedStyle(document.querySelector('.quiz')).display`),
    'grid',
  )
  await content.executeJavaScript(`document.querySelector('.quiz button:last-child').click()`)
  await waitFor(
    () => content.executeJavaScript(`document.querySelector('[data-answer]').textContent.length>0`),
    Boolean,
  )
  await content.executeJavaScript(`document.querySelector('.quiz button:last-child').click()`)
  await waitFor(
    () =>
      content.executeJavaScript(
        `document.querySelector('[data-answer]')?.textContent==='' && document.querySelector('[data-question]')?.textContent.length>0`,
      ),
    Boolean,
  )
  await waitFor(
    async () => progress().find(({ key }) => key === 'quiz:all')?.value,
    (value) => value === 1,
  )
  const nextQuestion = await content.executeJavaScript(
    `document.querySelector('[data-question]').textContent`,
  )
  await content.executeJavaScript(`document.querySelector('.quiz button:last-child').click()`)
  await waitFor(
    () => content.executeJavaScript(`document.querySelector('[data-answer]').textContent.length>0`),
    Boolean,
  )
  await assertShortcutsSuspended()
  await evaluate(`document.querySelector('[data-plugin-panel] header button').click()`)
  await waitFor(
    () =>
      evaluate<boolean>(
        `!document.querySelector('[data-plugin-panel]') && document.activeElement.closest('#canvas')!==null`,
      ),
    Boolean,
  )
  assert.equal(
    await evaluate(`document.querySelector('#canvas .react-flow')===window.__canvas`),
    true,
  )
  assert.deepEqual(saved.get('document'), before)
  await open()
  const frame = context.window.webContents.mainFrame.framesInSubtree.find(
    (frame) => frame.url === 'about:srcdoc',
  )!
  await waitFor(
    () =>
      frame.executeJavaScript(
        `document.querySelectorAll('.quiz button').length===2 && !document.querySelector('.quiz button').disabled`,
      ),
    Boolean,
  )
  assert.equal(
    await frame.executeJavaScript(`document.querySelector('[data-question]').textContent`),
    nextQuestion,
  )
  assert.equal(
    await frame.executeJavaScript(`document.querySelector('[data-answer]').textContent`),
    '',
  )
  await frame.executeJavaScript(`document.querySelector('.quiz button').click()`)
  await waitFor(
    async () => progress().find(({ key }) => key === 'quiz:all')?.value,
    (value) => value === 0,
  )
  await waitFor(
    () =>
      frame.executeJavaScript(
        `document.querySelector('.quiz button:last-child')?.textContent==='Show concept'`,
      ),
    Boolean,
  )
  assert.equal(
    await frame.executeJavaScript(`document.querySelector('[data-question]').textContent`),
    firstQuestion,
  )
  await frame.executeJavaScript(`void Promise.reject(new Error('Example request failed'))`)
  await waitFor(
    () => evaluate<boolean>(`!!document.querySelector('[data-plugin-panel] [role="alert"]')`),
    Boolean,
  )
  await evaluate(`document.querySelector('[data-plugin-panel] header button').click()`)
  await waitFor(() => evaluate<boolean>(`!document.querySelector('[data-plugin-panel]')`), Boolean)
  assert.deepEqual(saved.get('document'), before)
  const viewport = await evaluate<string>(
    `document.querySelector('#canvas .react-flow__viewport').style.transform`,
  )
  const concepts = await evaluate<number>(
    `document.querySelectorAll('#canvas .react-flow__node').length`,
  )
  await evaluate(
    `Object.defineProperty(navigator.clipboard,'readText',{configurable:true,value:()=>new Promise(resolve=>{window.__resolvePaste=resolve})});document.querySelector('#canvas button[aria-label="Paste"]').click()`,
  )
  assert.equal(await evaluate(`typeof window.__resolvePaste`), 'function')
  for (const tab of ['Notes', 'Review', 'Graph']) {
    await evaluate(
      `window.__panelFrame=document.querySelector('#canvas iframe');[...document.querySelectorAll('#canvas [role="tab"]')].find(tab=>tab.textContent.trim().startsWith(${JSON.stringify(tab)})).click()`,
    )
    await waitFor(
      () =>
        evaluate<boolean>(
          tab === 'Graph'
            ? `!document.querySelector('#canvas iframe') && document.activeElement===window.__canvas.parentElement`
            : `document.querySelector('#canvas iframe')!==window.__panelFrame && document.querySelector('#canvas iframe')?.style.visibility==='visible'`,
        ),
      Boolean,
    )
    assert.deepEqual(
      await evaluate(
        `(()=>{const canvas=document.querySelector('#canvas .react-flow');return {same:canvas===window.__canvas,visible:canvas.checkVisibility(),inert:!!canvas.closest('[inert]'),viewport:canvas.querySelector('.react-flow__viewport').style.transform}})()`,
      ),
      {
        same: true,
        visible: tab === 'Graph',
        inert: tab !== 'Graph',
        viewport,
      },
    )
    if (tab !== 'Graph') await assertShortcutsSuspended()
  }
  assert.equal(
    await evaluate(
      `new Promise(resolve=>{window.__resolvePaste(${JSON.stringify(JSON.stringify((before as { graph: unknown }).graph))});requestAnimationFrame(()=>{delete navigator.clipboard.readText;resolve(document.querySelectorAll('#canvas .react-flow__node').length)})})`,
    ),
    concepts,
  )
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true}))`,
  )
  assert.equal(
    await evaluate(
      `document.querySelectorAll('#canvas .react-flow__node.selected').length===document.querySelectorAll('#canvas .react-flow__node').length`,
    ),
    true,
  )
  await evaluate(
    `window.__canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
  )
  assert.deepEqual(saved.get('document'), before)
  await open()
  const reused = context.window.webContents.mainFrame.framesInSubtree.find(
    (frame) => frame.url === 'about:srcdoc',
  )!
  await evaluate(`window.__externalFrame=document.querySelector('[data-plugin-panel] iframe')`)
  await reused.executeJavaScript(`window.__retainedDocument=document`)
  for (const view of ['Energy', 'Rest', 'Overview']) {
    await evaluate(
      `[...document.querySelectorAll('#saved-views button,#pinned-views button')].find(button=>button.textContent.trim().startsWith(${JSON.stringify(view)})).click()`,
    )
    await waitFor(
      () =>
        evaluate<boolean>(
          `document.querySelector('[data-plugin-panel] iframe')?.style.visibility==='visible' && document.querySelector('[data-plugin-panel] h2')?.textContent===${JSON.stringify(view)}`,
        ),
      Boolean,
    )
    assert.equal(
      await evaluate(
        `document.querySelector('[data-plugin-panel] iframe')===window.__externalFrame`,
      ),
      true,
    )
    assert.equal(await reused.executeJavaScript(`window.__retainedDocument===document`), true)
    await waitFor(() => reused.executeJavaScript(`!!document.querySelector('.quiz')`), Boolean)
    assert.equal(
      await reused.executeJavaScript(`document.querySelector('[data-answer]')?.textContent??''`),
      '',
    )
  }
  await evaluate(`document.querySelector('[data-plugin-panel] header button').click()`)
  await waitFor(() => evaluate<boolean>(`!document.querySelector('[data-plugin-panel]')`), Boolean)
  assert.equal(
    await evaluate(
      `document.querySelector('#canvas .react-flow__viewport').style.transform.includes('NaN')`,
    ),
    false,
  )
  assert.deepEqual(
    (saved.get('document') as { graph: unknown }).graph,
    (before as { graph: unknown }).graph,
  )
  console.log(
    'desktop: external panels and bundled tabs preserve the canvas and viewport; focus restoration, shortcut suspension and crash recovery passed',
  )
}

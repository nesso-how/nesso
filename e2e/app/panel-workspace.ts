import assert from 'node:assert/strict'
import { Menu } from 'electron'
import source from '../../packages/plugin/example/package.json' with { type: 'json' }
import { connectMenu, connectTabShortcuts } from '../../electron/menu.ts'
import {
  chooseTab,
  listExamplePlugin,
  openFixtureWorkspace,
  panelFrame,
  waitFor,
  type CheckContext,
} from '../helpers.ts'

export async function verifyPanelWorkspace(context: CheckContext) {
  connectMenu(() => true, false)
  await listExamplePlugin()
  const { evaluate, saved } = await openFixtureWorkspace(context)
  const preloaded = await waitFor(
    async () =>
      context.window.webContents.mainFrame.framesInSubtree.filter(
        (frame) => frame?.url === 'about:srcdoc',
      ),
    (frames) => frames.length === 2,
  )
  for (const frame of preloaded)
    assert.equal(await frame.executeJavaScript(`document.getElementById('root').textContent`), '')
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
  const graph = async () => {
    await choose('Map')
    await waitFor(
      () => evaluate<boolean>(`!document.querySelector('[data-plugin-panel]')`),
      Boolean,
    )
  }
  const tabs = () =>
    evaluate<{ visible: string[]; hidden: string[] }>(
      `(async()=>{const visible=[...document.querySelectorAll('#canvas [role="tab"]')].map(tab=>tab.textContent.trim().replace(/\\d+$/,''));const more=document.querySelector('#canvas button.canvas-tabs-more');if(!more)return {visible,hidden:[]};more.click();await new Promise(resolve=>setTimeout(resolve,100));const hidden=[...document.querySelectorAll('[role="menuitem"]')].map(item=>item.textContent.trim().replace(/(Ctrl\\+|⌘)\\d$/,'').replace(/\\d+$/,''));document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));return {visible,hidden}})()`,
    )
  const choose = (name: string) => chooseTab(evaluate, name)
  const open = async () => {
    await choose('Concept Quiz')
    await waitFor(
      () =>
        evaluate<boolean>(
          `document.querySelector('[data-plugin-panel] iframe:not([hidden])')?.style.visibility==='visible'`,
        ),
      Boolean,
    )
  }
  await waitFor(
    async () => saved.get('document') as { workspace: { viewports: Record<string, unknown> } },
    (record) => Object.keys(record?.workspace.viewports ?? {}).length > 0,
  )
  const before = structuredClone(saved.get('document'))
  const header = await evaluate<string>(
    `getComputedStyle(document.querySelector('#canvas header')).height`,
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
      `(()=>{const header=document.querySelector('#canvas header');return {header:document.querySelectorAll('#canvas header').length,height:getComputedStyle(header).height,selected:header.querySelector('[role="tab"][aria-selected="true"]').textContent.trim(),inert:!!header.closest('[inert]')}})()`,
    ),
    { header: 1, height: header, selected: 'Concept Quiz', inert: false },
  )
  assert.equal(
    await evaluate(`document.querySelector('[data-plugin-panel]').getAttribute('aria-busy')`),
    'false',
  )
  assert.equal(
    await evaluate(
      `!document.querySelector('#canvas .react-flow').checkVisibility() && !!document.querySelector('#canvas .react-flow').closest('[inert]')`,
    ),
    true,
  )
  const content = await panelFrame(
    context.window,
    `document.querySelectorAll('.quiz button').length===2 && !document.querySelector('.quiz button').disabled`,
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
  const pixelRatio = await evaluate<number>('window.devicePixelRatio')
  const zoomIn = Menu.getApplicationMenu()
    ?.items.flatMap((item) => item.submenu?.items ?? [])
    .find((item) => item.accelerator === 'CmdOrCtrl+=')
  assert.ok(zoomIn)
  zoomIn.click({}, context.window, context.window.webContents)
  await waitFor(async () => {
    const ratio = await evaluate<number>('window.devicePixelRatio')
    return (
      ratio > pixelRatio && ratio === (await content.executeJavaScript('window.devicePixelRatio'))
    )
  }, Boolean)
  context.window.webContents.setZoomLevel(0)
  await waitFor(
    () => content.executeJavaScript('window.devicePixelRatio'),
    (ratio) => ratio === pixelRatio,
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
    async () => progress().find(({ key }) => key === 'quiz:coffee')?.value,
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
  await graph()
  await waitFor(async () => content.detached, Boolean)
  await waitFor(
    () => evaluate<boolean>(`document.activeElement.closest('#canvas')!==null`),
    Boolean,
  )
  assert.equal(
    await evaluate(`document.querySelector('#canvas .react-flow')===window.__canvas`),
    true,
  )
  assert.deepEqual(saved.get('document'), before)
  await open()
  const frame = await panelFrame(
    context.window,
    `document.querySelectorAll('.quiz button').length===2 && !document.querySelector('.quiz button').disabled`,
  )
  assert.notEqual(frame, content)
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
    async () => progress().find(({ key }) => key === 'quiz:coffee')?.value,
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
  await graph()
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
  for (const tab of ['Notes', 'Review', 'Map']) {
    await choose(tab)
    await waitFor(
      () =>
        evaluate<boolean>(
          tab === 'Map'
            ? `!document.querySelector('[data-plugin-panel]') && document.activeElement===window.__canvas.parentElement`
            : `document.querySelector('[data-plugin-panel] iframe:not([hidden])')?.style.visibility==='visible'`,
        ),
      Boolean,
    )
    assert.deepEqual(
      await evaluate(
        `(()=>{const canvas=document.querySelector('#canvas .react-flow');return {same:canvas===window.__canvas,visible:canvas.checkVisibility(),inert:!!canvas.closest('[inert]'),viewport:canvas.querySelector('.react-flow__viewport').style.transform}})()`,
      ),
      {
        same: true,
        visible: tab === 'Map',
        inert: tab !== 'Map',
        viewport,
      },
    )
    if (tab !== 'Map') {
      const frame = await panelFrame(
        context.window,
        tab === 'Notes'
          ? `!!document.querySelector('.notes-editor')`
          : `!!document.querySelector('.review-start')`,
      )
      assert.ok(preloaded.includes(frame))
      await assertShortcutsSuspended()
    }
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
  const order = await tabs()
  assert.deepEqual([...order.visible, ...order.hidden], ['Map', 'Notes', 'Review', 'Concept Quiz'])
  await waitFor(
    async () =>
      (saved.get('preferences') as { preferences: { canvasTabOrder?: string[] } } | undefined)
        ?.preferences.canvasTabOrder,
    (order) =>
      JSON.stringify(order) ===
      JSON.stringify([
        '@nesso-how/notes:notes',
        '@nesso-how/review:review',
        `${source.name}:concept-quiz`,
      ]),
  )
  connectTabShortcuts(context.window.webContents)
  for (const [digit, selected] of [
    [4, 'Concept Quiz'],
    [2, 'Notes'],
    [1, 'Map'],
  ] as const) {
    await evaluate(`document.querySelector('[data-plugin-panel] iframe:not([hidden])')?.focus()`)
    context.window.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: String(digit),
      modifiers: [process.platform === 'darwin' ? 'meta' : 'control'],
    })
    await waitFor(
      () =>
        evaluate<boolean>(
          `document.querySelector('#canvas [role="tab"][aria-selected="true"]')?.textContent.trim()===${JSON.stringify(selected)} && ${selected === 'Map' ? `!document.querySelector('[data-plugin-panel]')` : `document.querySelector('[data-plugin-panel] iframe:not([hidden])')?.style.visibility==='visible'`}`,
        ),
      Boolean,
    )
  }
  await open()
  const reused = await panelFrame(context.window, `!!document.querySelector('.quiz')`)
  assert.equal(await evaluate(`document.querySelectorAll('#canvas iframe').length`), 3)
  await evaluate(
    `window.__externalFrame=document.querySelector('[data-plugin-panel] iframe:not([hidden])')`,
  )
  await reused.executeJavaScript(`window.__retainedDocument=document`)
  for (const view of ['Rest', 'Overview', 'Coffee']) {
    await evaluate(
      `[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(${JSON.stringify(view)})).click()`,
    )
    await waitFor(
      () =>
        evaluate<boolean>(
          `document.querySelector('[data-plugin-panel] iframe:not([hidden])')?.style.visibility==='visible' && document.querySelector('#canvas .nesso-panel-actions button')?.getAttribute('aria-label')===${JSON.stringify(`Actions for ${view}`)}`,
        ),
      Boolean,
    )
    assert.equal(
      await evaluate(
        `document.querySelector('[data-plugin-panel] iframe:not([hidden])')===window.__externalFrame`,
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
  await choose('Notes')
  await waitFor(
    () =>
      evaluate<boolean>(
        `document.querySelector('[data-plugin-panel]')?.getAttribute('aria-busy')==='false'`,
      ),
    Boolean,
  )
  await waitFor(async () => reused.detached, Boolean)
  assert.equal(
    await evaluate(
      `document.querySelector('[data-plugin-panel] [role="alert"]')?.textContent ?? null`,
    ),
    null,
  )
  assert.ok(
    preloaded.includes(
      await panelFrame(context.window, `!!document.querySelector('.notes-editor .cm-content')`),
    ),
  )
  await choose('Review')
  assert.ok(
    preloaded.includes(
      await panelFrame(context.window, `!!document.querySelector('.review-start')`),
    ),
  )
  assert.equal(await evaluate(`document.querySelectorAll('#canvas iframe').length`), 2)
  await graph()
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
    'desktop: retained built-ins, transient panels, clean sessions, canvas preservation, focus and shortcuts passed',
  )
}

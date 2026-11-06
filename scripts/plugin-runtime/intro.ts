import assert from 'node:assert/strict'
import { ipcMain } from 'electron'
import { connectFixtureStorage, waitFor, type CheckContext } from './helpers.ts'

export async function verifyIntro({ window, url, name }: CheckContext) {
  const saved = connectFixtureStorage()
  ipcMain.handle('plugins:list', () => ({ value: { safeMode: false, packages: [], issues: [] } }))
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  const ready = (script: string) => waitFor(() => evaluate<boolean>(script), Boolean)
  const next = () =>
    evaluate(`document.querySelector('.intro-navigation button:last-child').click()`)
  const previous = () =>
    evaluate(`document.querySelector('.intro-navigation button[aria-label]').click()`)
  const title = (text: string) =>
    ready(`document.querySelector('#intro-title')?.textContent===${JSON.stringify(text)}`)
  const key = (keyCode: string) => {
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode })
  }
  const handle = async (label: string) => {
    await evaluate(`document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}).focus()`)
    key('Enter')
  }
  const frames = () =>
    evaluate<Record<string, string>>(
      `Object.fromEntries([...document.querySelectorAll('.intro .react-flow__node')].map(node=>[node.dataset.id,node.style.transform]))`,
    )

  window.setContentSize(1280, 900)
  await window.loadURL(url)
  await title('Start from an idea')
  await ready(`!document.querySelector('.splash')`)
  await ready(`document.querySelectorAll('.intro .react-flow__node').length===1`)
  assert.equal(await evaluate(`!!document.querySelector('.intro-scrim')`), true)
  if (name === 'desktop') await waitFor(async () => saved.has('document'), Boolean)
  const before = structuredClone(saved.get('document'))
  await next()
  await title('Decide how they connect')
  assert.equal(await evaluate(`!!document.querySelector('.intro-scrim')`), false)
  await ready(
    `document.querySelector('[aria-label="Connect from Coffee"]')?.getAttribute('aria-hidden')==='false'`,
  )
  assert.equal(await evaluate(`document.querySelectorAll('.intro .react-flow__edge').length`), 0)

  await handle('Connect from Coffee')
  await ready(
    `document.querySelector('[aria-label="Connect to Sleep"]')?.getAttribute('aria-hidden')==='false'`,
  )
  key('Escape')
  await ready(
    `document.querySelector('[aria-label="Connect to Sleep"]')?.getAttribute('aria-hidden')==='true'`,
  )
  assert.equal(
    await evaluate(`document.querySelector('.intro .react-flow__node.selected')?.textContent`),
    'Coffee',
  )
  await handle('Connect from Coffee')
  await ready(
    `document.querySelector('[aria-label="Connect to Sleep"]')?.getAttribute('aria-hidden')==='false'`,
  )
  await handle('Connect to Sleep')
  await ready(`document.activeElement?.id==='relation-label'`)
  for (const label of ['Invert direction', 'Delete']) {
    assert.equal(
      await evaluate(
        `[...document.querySelectorAll('.intro-inspector button')].find(button=>button.textContent===${JSON.stringify(label)})?.disabled`,
      ),
      true,
    )
  }
  assert.equal(await evaluate(`document.querySelector('#relation-label').value`), '')
  await window.webContents.insertText('keeps me awake')
  key('Enter')
  await ready(
    `document.querySelector('.intro-relation')?.textContent==='Coffee · keeps me awake · Sleep'`,
  )

  await next()
  await title('See it from another angle')
  await ready(`document.querySelectorAll('.intro .react-flow__node').length===4`)
  const positions = await frames()
  for (const view of ['Energy', 'Rest']) {
    await evaluate(
      `[...document.querySelectorAll('.intro-explorer button')].find(button=>button.textContent.startsWith('${view}')).click()`,
    )
    await ready(`document.querySelectorAll('.intro .graph-outside-node').length===1`)
    assert.deepEqual(await frames(), positions)
  }
  await next()
  await title('Test yourself')
  await ready(
    `document.querySelector('.intro-review-tab[aria-disabled="true"]')?.textContent==='Review3'`,
  )
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('.intro [role="tab"]')].map(tab=>[tab.textContent,tab.getAttribute('aria-disabled')==='true'])`,
    ),
    [
      ['Graph', false],
      ['Notes', true],
      ['Review3', true],
    ],
  )
  await evaluate(`document.querySelector('.intro-review-tab').click()`)
  assert.equal(
    await evaluate(`document.querySelectorAll('[data-plugin-panel], .intro iframe').length`),
    0,
  )
  assert.equal(
    await evaluate(`document.querySelector('.intro-relation').textContent`),
    'Coffee · keeps me awake · Sleep',
  )
  await previous()
  await previous()
  await title('Decide how they connect')
  await ready(`document.querySelector('#relation-label')?.value==='keeps me awake'`)
  assert.equal(saved.get('plugin-storage'), undefined)
  assert.deepEqual(saved.get('document'), before)
  await next()
  await next()
  await next()
  await ready(
    `!document.querySelector('.intro') && !!document.querySelector('#canvas .react-flow')`,
  )
  await ready(
    `[...document.querySelectorAll('#canvas .react-flow__edge-text')].some(edge=>edge.textContent==='can disrupt')`,
  )
  if (name === 'desktop') {
    assert.deepEqual(
      (saved.get('document') as { graph: unknown }).graph,
      (before as { graph: unknown }).graph,
    )
  }
}

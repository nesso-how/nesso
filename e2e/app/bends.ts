import assert from 'node:assert/strict'
import { ipcMain } from 'electron'
import { openFixtureWorkspace, waitFor, type CheckContext } from '../helpers.ts'

export async function verifyBends(context: CheckContext) {
  ipcMain.handle('plugins:list', () => ({
    value: { safeMode: false, packages: [], incompatible: [], issues: [] },
  }))
  context.window.setContentSize(1280, 900)
  const { evaluate } = await openFixtureWorkspace(context, context.name === 'desktop')
  const ready = (script: string) => waitFor(() => evaluate<boolean>(script), Boolean)
  const click = (selector: string) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const key = (keyCode: string) => {
    context.window.webContents.sendInputEvent({ type: 'keyDown', keyCode })
    context.window.webContents.sendInputEvent({ type: 'keyUp', keyCode })
  }
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith('Energy')).click()`,
  )
  await ready(`!!document.querySelector('#canvas .react-flow__edge-interaction')`)
  await evaluate(
    `document.querySelector('#canvas .react-flow__edge-interaction').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
  )
  const handle = '#canvas [data-bend-id]'
  await ready(`!!document.querySelector('${handle}')`)
  const id = await evaluate<string>(
    `document.querySelector('${handle}').getAttribute('data-bend-id')`,
  )
  const edge = `#canvas .react-flow__edge[data-id="${id.replaceAll('"', '\\"')}"]`
  const path = () =>
    evaluate<string>(
      `document.querySelector(${JSON.stringify(`${edge} .react-flow__edge-path`)}).getAttribute('d')`,
    )
  const select = () =>
    evaluate(
      `document.querySelector(${JSON.stringify(`${edge} .react-flow__edge-interaction`)}).dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
    )
  const automatic = await path()
  await evaluate(`document.querySelector('#canvas .react-flow').parentElement.focus()`)
  key('B')
  await ready(`document.activeElement?.matches('${handle}')`)
  context.window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Up' })
  await ready(`Number(document.querySelector('${handle}').getAttribute('aria-valuenow'))===0.025`)
  context.window.webContents.sendInputEvent({
    type: 'keyDown',
    keyCode: 'Up',
    modifiers: ['isautorepeat'],
  })
  await ready(`Number(document.querySelector('${handle}').getAttribute('aria-valuenow'))===0.05`)
  context.window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Up' })
  const keyboard = await path()
  assert.notEqual(keyboard, automatic)
  await click('#canvas [aria-label="Undo"]')
  await ready(`Number(document.querySelector('${handle}').getAttribute('aria-valuenow'))===0`)
  assert.equal(await path(), automatic)
  await click('#canvas [aria-label="Redo"]')
  await ready(`Number(document.querySelector('${handle}').getAttribute('aria-valuenow'))===0.05`)
  const points = await evaluate<{ x: number; y: number; dx: number; dy: number }>(`(() => {
    const handle=document.querySelector('${handle}').getBoundingClientRect()
    const path=document.querySelector(${JSON.stringify(`${edge} .react-flow__edge-path`)})
    const start=path.getPointAtLength(0),end=path.getPointAtLength(path.getTotalLength())
    const length=Math.hypot(end.x-start.x,end.y-start.y)
    return {x:Math.round(handle.x+handle.width/2),y:Math.round(handle.y+handle.height/2),
      dx:Math.round((start.y-end.y)/length*65),dy:Math.round((end.x-start.x)/length*65)}
  })()`)
  const pointer = (type: 'mouseDown' | 'mouseMove' | 'mouseUp', moved = false) =>
    context.window.webContents.sendInputEvent({
      type,
      button: 'left',
      clickCount: 1,
      x: points.x + (moved ? points.dx : 0),
      y: points.y + (moved ? points.dy : 0),
    })
  await evaluate(
    `window.__released=false;addEventListener('pointerup',()=>{window.__released=true},{capture:true,once:true})`,
  )
  pointer('mouseDown')
  pointer('mouseMove', true)
  await waitFor(path, (value) => value !== keyboard)
  pointer('mouseUp', true)
  await ready('window.__released')
  const dragged = await path()
  assert.notEqual(dragged, keyboard)
  await click('#canvas [aria-label="Undo"]')
  await waitFor(path, (value) => value === keyboard)
  await click('#canvas [aria-label="Redo"]')
  await waitFor(path, (value) => value === dragged)
  await evaluate(
    `document.querySelector('${handle}').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
  )
  await waitFor(path, (value) => value === automatic)
  await click('#canvas [aria-label="Undo"]')
  await waitFor(path, (value) => value === dragged)
  const relation = JSON.parse(id) as [string, string, string]
  await click(`#canvas .react-flow__node[data-id="${relation[0]}"]`)
  await evaluate(`document.querySelector('#canvas .react-flow').parentElement.focus()`)
  key('L')
  await select()
  await ready(`Number(document.querySelector('${handle}').getAttribute('aria-valuenow'))===0`)
  await click('#canvas [aria-label="Undo"]')
  await waitFor(path, (value) => value === dragged)
  await select()
  await click('#canvas [aria-label="Lock interactions"]')
  await ready(`!document.querySelector('${handle}')`)
  await click('#canvas [aria-label="Unlock interactions"]')
  await ready(`!!document.querySelector('${handle}')`)
}

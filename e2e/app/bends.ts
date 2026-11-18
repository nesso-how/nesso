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
  const anchorsAligned = `(() => {
    const edge=document.querySelector(${JSON.stringify(edge)})
    const path=edge.querySelector('.react-flow__edge-path'),matrix=path.getScreenCTM()
    return ['source','target'].every((end,index)=>{
      const anchor=edge.querySelector('.react-flow__edgeupdater-'+end)
      if(!anchor)return false
      const box=anchor.getBoundingClientRect()
      const point=path.getPointAtLength(index?path.getTotalLength():0)
      const screen=new DOMPoint(point.x,point.y).matrixTransform(matrix)
      return Math.abs(Math.hypot(box.x+box.width/2-screen.x,box.y+box.height/2-screen.y)-box.width/2)<1
    })
  })()`
  await ready(anchorsAligned)
  const automatic = await path()
  const points = await evaluate<{ x: number; y: number; dx: number; dy: number }>(`(() => {
    const path=document.querySelector(${JSON.stringify(`${edge} .react-flow__edge-path`)})
    const matrix=path.getScreenCTM()
    const screen=(point)=>new DOMPoint(point.x,point.y).matrixTransform(matrix)
    const start=screen(path.getPointAtLength(0)),end=screen(path.getPointAtLength(path.getTotalLength()))
    const handle=document.querySelector('${handle}').getBoundingClientRect()
    const length=Math.hypot(end.x-start.x,end.y-start.y)
    return {x:Math.round(handle.x+handle.width/2),y:Math.round(handle.y+handle.height/2),
      dx:Math.round((start.y-end.y)/length*65),dy:Math.round((end.x-start.x)/length*65)}
  })()`)
  context.window.webContents.sendInputEvent({ type: 'mouseMove', x: points.x, y: points.y })
  await ready(`(() => {
    const handle=document.querySelector('${handle}').getBoundingClientRect()
    return Math.hypot(handle.x+handle.width/2-${points.x},handle.y+handle.height/2-${points.y})<4
      && !!document.elementFromPoint(${points.x},${points.y})?.closest('${handle}')
  })()`)
  const pointer = (type: 'mouseDown' | 'mouseMove' | 'mouseUp', progress = 0) =>
    context.window.webContents.sendInputEvent({
      type,
      button: 'left',
      modifiers: type === 'mouseMove' ? ['leftbuttondown'] : [],
      clickCount: 1,
      x: points.x + Math.round(points.dx * progress),
      y: points.y + Math.round(points.dy * progress),
    })
  await evaluate(
    `window.__released=false;addEventListener('pointerup',()=>{window.__released=true},{capture:true,once:true})`,
  )
  pointer('mouseDown')
  for (let step = 1; step <= 16; step++) {
    pointer('mouseMove', step / 16)
    const x = points.x + Math.round((points.dx * step) / 16)
    const y = points.y + Math.round((points.dy * step) / 16)
    await ready(`(() => {
      const box=document.querySelector('${handle}').getBoundingClientRect()
      return Math.hypot(box.x+box.width/2-${x},box.y+box.height/2-${y})<4
    })()`)
    await ready(anchorsAligned)
  }
  pointer('mouseUp', 1)
  await ready('window.__released')
  const dragged = await path()
  assert.notEqual(dragged, automatic)
  await ready(anchorsAligned)
  await ready(`(() => {
    const box=document.querySelector('${handle}').getBoundingClientRect()
    return Math.hypot(box.x+box.width/2-${points.x + points.dx},box.y+box.height/2-${points.y + points.dy})<4
  })()`)
  await click('#canvas [aria-label="Undo"]')
  await waitFor(path, (value) => value === automatic)
  await ready(anchorsAligned)
  await click('#canvas [aria-label="Redo"]')
  await waitFor(path, (value) => value === dragged)
  await ready(anchorsAligned)
  const openRelationMenu = () =>
    evaluate(
      `document.querySelector(${JSON.stringify(`${edge} .react-flow__edge-path`)}).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:${points.x},clientY:${points.y}}))`,
    )
  const resetItem = `[...document.querySelectorAll('[role="menuitem"]')].find(item=>item.textContent.trim()==='Reset curve')`
  await openRelationMenu()
  await ready(`!!(${resetItem}) && (${resetItem}).getAttribute('aria-disabled')!=='true'`)
  await evaluate(`(${resetItem}).click()`)
  await waitFor(path, (value) => value === automatic)
  await click('#canvas [aria-label="Undo"]')
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
  await waitFor(path, (value) => value !== dragged)
  await openRelationMenu()
  await ready(`(${resetItem})?.getAttribute('aria-disabled')==='true'`)
  await ready(`!!document.activeElement?.closest('[role="menu"]')`)
  key('Escape')
  await ready(`!(${resetItem})`)
  await click('#canvas [aria-label="Undo"]')
  await waitFor(path, (value) => value === dragged)
  await click('#canvas [aria-label="Lock interactions"]')
  await ready(`!document.querySelector('${handle}')`)
  await click('#canvas [aria-label="Unlock interactions"]')
  await ready(`!!document.querySelector('${handle}')`)
}

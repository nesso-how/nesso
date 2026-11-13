import assert from 'node:assert/strict'
import { ipcMain } from 'electron'
import { openFixtureWorkspace, waitFor, type CheckContext } from './helpers.ts'

export async function verifyCreation(context: CheckContext) {
  ipcMain.handle('plugins:list', () => ({
    value: { safeMode: false, packages: [], incompatible: [], issues: [] },
  }))
  context.window.setContentSize(1280, 900)
  const { evaluate } = await openFixtureWorkspace(context, false)
  const ready = (script: string) => waitFor(() => evaluate<boolean>(script), Boolean)
  const click = (selector: string) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const key = (keyCode: string) => {
    context.window.webContents.sendInputEvent({ type: 'keyDown', keyCode })
    context.window.webContents.sendInputEvent({ type: 'keyUp', keyCode })
  }
  const nodes = () =>
    evaluate<string[]>(
      `[...document.querySelectorAll('#canvas .react-flow__node[data-id]')].map(node=>node.dataset.id).sort()`,
    )
  const label = '[aria-label="Edit concept label"]'
  const sleep = 'urn:nesso:example:sleep'
  const coffee = '#canvas [data-id="urn:nesso:example:coffee"]'
  const create = async () => {
    await click(coffee)
    await click('#canvas [aria-label="Add concept"]')
    await ready(`document.activeElement?.matches('${label}')`)
  }
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith('Energy')).click()`,
  )
  await ready(`document.querySelectorAll('#canvas .react-flow__node[data-id]').length===3`)
  const baseline = await nodes()
  for (const mouse of [false, true]) {
    await create()
    const provisional = await evaluate<string>(
      `document.querySelector('${label}').closest('.react-flow__node').style.transform`,
    )
    await context.window.webContents.insertText('sle')
    await ready(`document.querySelector('[role="option"]')?.textContent==='Sleep'`)
    if (mouse) {
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const box=document.querySelector('[role="option"]').getBoundingClientRect();return {x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)}})()`,
      )
      context.window.webContents.sendInputEvent({
        type: 'mouseDown',
        ...point,
        button: 'left',
        clickCount: 1,
      })
      context.window.webContents.sendInputEvent({
        type: 'mouseUp',
        ...point,
        button: 'left',
        clickCount: 1,
      })
    } else {
      key('Down')
      key('Enter')
    }
    await ready(
      `!!document.querySelector('#canvas [data-id="${sleep}"].selected')&&!document.querySelector('${label}')`,
    )
    assert.equal(
      await evaluate(`document.querySelector('#canvas [data-id="${sleep}"]').style.transform`),
      provisional,
    )
    assert.deepEqual(await nodes(), [...baseline, sleep].sort())
    await click('#canvas [aria-label="Undo"]')
    await ready(`!document.querySelector('#canvas [data-id="${sleep}"]')`)
    assert.deepEqual(await nodes(), baseline)
    if (!mouse) {
      await click('#canvas [aria-label="Redo"]')
      await ready(`!!document.querySelector('#canvas [data-id="${sleep}"]')`)
      await click('#canvas [aria-label="Undo"]')
      await ready(`!document.querySelector('#canvas [data-id="${sleep}"]')`)
    }
  }

  await click(coffee)
  await evaluate(`document.querySelector('${coffee} .concept-node').focus()`)
  key('Enter')
  await ready(`document.activeElement?.matches('${label}')`)
  await context.window.webContents.insertText('sle')
  assert.equal(
    await evaluate(`document.querySelector('${label}').getAttribute('aria-expanded')`),
    'false',
  )
  key('Escape')
  await ready(`!document.querySelector('${label}')`)
  assert.equal(
    await evaluate(`document.querySelector('${coffee} .concept-node span').textContent`),
    'Coffee',
  )

  for (const cancel of [false, true]) {
    await create()
    const original = await evaluate(`document.querySelector('${label}').value`)
    await context.window.webContents.insertText('Sleep')
    await ready(`!!document.querySelector('[role="option"]')`)
    key(cancel ? 'Escape' : 'Enter')
    await ready(`!document.querySelector('${label}')`)
    assert.equal(
      await evaluate(
        `document.querySelector('#canvas .react-flow__node.selected .concept-node span').textContent`,
      ),
      cancel ? original : 'Sleep',
    )
    assert.equal(await evaluate(`!!document.querySelector('#canvas [data-id="${sleep}"]')`), false)
    await click('#canvas [aria-label="Undo"]')
    await ready(
      `document.querySelectorAll('#canvas .react-flow__node[data-id]').length===${baseline.length}`,
    )
    assert.deepEqual(await nodes(), baseline)
  }

  await click(coffee)
  await click('[aria-label="New view"]')
  await ready(`!!document.querySelector('[role="dialog"] input')`)
  await evaluate(`document.querySelector('[role="dialog"] input').focus()`)
  await context.window.webContents.insertText('Single')
  await click('[role="dialog"] button[type="submit"]')
  await ready(`document.querySelectorAll('#canvas .react-flow__node[data-id]').length===1`)
  const original = await evaluate(`document.querySelector('${coffee}').style.transform`)
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith('Energy')).click()`,
  )
  const focus = '#canvas [data-id="urn:nesso:example:focus"]'
  await ready(`!!document.querySelector('${focus}')`)
  await click(focus)
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith('Other views')).click()`,
  )
  await ready(`document.activeElement?.matches('[aria-label="Find a view"]')`)
  await context.window.webContents.insertText('Single')
  await ready(`document.querySelector('[role="option"]')?.textContent==='Single'`)
  await click('[role="option"]')
  await ready(
    `document.querySelectorAll('#canvas .react-flow__node[data-id]').length===2 && document.querySelector('${focus}.selected')?.checkVisibility() && [...document.querySelectorAll('button[aria-current="page"]')].some(button=>button.textContent.trim().startsWith('Single'))`,
  )
  assert.equal(await evaluate(`document.querySelector('${coffee}').style.transform`), original)
  assert.equal(
    await evaluate(
      `(()=>{const a=document.querySelector('${coffee}').getBoundingClientRect();const b=document.querySelector('${focus}').getBoundingClientRect();return a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top})()`,
    ),
    true,
  )
  await click('#canvas [aria-label="Undo"]')
  await ready(`!document.querySelector('${focus}') && !!document.querySelector('${coffee}')`)
}

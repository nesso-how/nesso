import assert from 'node:assert/strict'
import { ipcMain } from 'electron'
import { openFixtureWorkspace, waitFor, type CheckContext } from '../helpers.ts'

export async function verifyMapGroups(context: CheckContext) {
  const { window } = context
  ipcMain.handle('plugins:list', () => ({
    value: { safeMode: false, packages: [], incompatible: [], issues: [] },
  }))
  window.setContentSize(1280, 900)
  const { evaluate } = await openFixtureWorkspace(context, false)
  window.webContents.debugger.attach()
  await window.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
    enabled: true,
  })
  const ready = (script: string) =>
    waitFor(() => evaluate<boolean>(script), Boolean, 6000).catch(async (cause: unknown) => {
      const active = await evaluate<string>(`document.activeElement?.outerHTML.slice(0, 300)`)
      throw new Error(`Timed out: ${script}\nFocused element: ${active}`, { cause })
    })
  const element = (selector: string, text: string) =>
    `[...document.querySelectorAll(${JSON.stringify(selector)})].find(element => element.textContent.trim()===${JSON.stringify(text)})`
  const click = async (expression: string) => {
    await ready(`!!(${expression})`)
    await evaluate(`(${expression}).click()`)
  }
  const key = (keyCode: string) => {
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode })
  }
  const section = (name: string) => element('button[aria-controls][aria-expanded]', name)
  const rows = (sectionName: string) =>
    `document.getElementById((${section(sectionName)})?.getAttribute('aria-controls'))`
  const actions = (sectionName: string) =>
    `(${rows(sectionName)})?.querySelector('[aria-label="Actions for Energy"]')`
  const menuItem = (name: string) => element('[role="menuitem"]', name)
  const group = 'Study'
  const pinned = 'Pinned maps'
  const ungrouped = 'Ungrouped'
  const groupActions = `document.querySelector('[aria-label="Actions for group ${group}"]')`
  const move = menuItem('Move to group')
  const remove = menuItem('Remove from group')
  const assignGroup = async () => {
    await ready(`!!(${move})`)
    assert.equal(await evaluate(`!!(${remove})`), false)
    await evaluate(`(${move}).focus()`)
    key('Right')
    const groupOption = element('[role="menuitemradio"]', group)
    await ready(
      `document.activeElement===(${groupOption}) || document.activeElement===(${menuItem('New group')})`,
    )
    if (!(await evaluate(`document.activeElement===(${groupOption})`))) key('Down')
    await ready(`document.activeElement===(${groupOption})`)
    key('Enter')
    await ready(
      `document.activeElement===(${actions(group)}) && !document.querySelector('[role="menu"]')`,
    )
  }

  await click(element('button', 'New group'))
  await ready(`!!document.querySelector('[role="dialog"] input')`)
  await evaluate(`document.querySelector('[role="dialog"] input').focus()`)
  await window.webContents.insertText(group)
  await click(`document.querySelector('[role="dialog"] button[type="submit"]:enabled')`)
  await ready(`!!(${section(group)}) && !document.querySelector('[role="dialog"]')`)
  assert.equal(
    await evaluate(`(() => {
      const button = ${groupActions}
      const rect = button.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.right - 2, rect.y + rect.height / 2)
      return button.contains(hit)
    })()`),
    true,
  )

  await click(actions(ungrouped))
  await assignGroup()
  await evaluate(`(${actions(group)}).closest('.group').querySelector('button').focus()`)
  key('Tab')
  await ready(
    `document.activeElement===(${actions(group)}) && document.activeElement.matches(':focus-visible')`,
  )
  assert.deepEqual(
    await evaluate(`({
      outline: getComputedStyle(document.activeElement).outlineStyle,
      offset: getComputedStyle(document.activeElement).outlineOffset,
      actionsOpacity: getComputedStyle(document.activeElement.parentElement).opacity,
    })`),
    { outline: 'solid', offset: '-2px', actionsOpacity: '1' },
  )
  await click(actions(group))
  await click(menuItem('Pin'))
  await ready(
    `!!(${actions(pinned)}) && !!(${actions(group)}) && !document.querySelector('[role="menu"]')`,
  )

  await click(actions(group))
  await ready(`!!(${move})`)
  await evaluate(`(${move}).focus()`)
  key('Down')
  await ready(`document.activeElement===(${remove})`)
  key('Enter')
  await ready(
    `document.activeElement===(${actions(ungrouped)}) && !document.querySelector('[role="menu"]')`,
  )
  assert.equal(await evaluate(`!!(${actions(pinned)}) && !(${actions(group)})`), true)
  await click(actions(ungrouped))
  await assignGroup()

  await click(section(group))
  await ready(
    `(${section(group)}).getAttribute('aria-expanded')==='false' && !(${actions(group)}).getClientRects().length`,
  )

  window.setContentSize(390, 844)
  const switcher = `document.querySelector('.compact-map-switcher')`
  await click(switcher)
  const energyOptions = `[...document.querySelectorAll('[role="menuitem"]')].filter(item=>item.textContent.trim().startsWith('Energy'))`
  await ready(`(${energyOptions}).length===2`)
  assert.deepEqual(
    await evaluate(
      `(${energyOptions}).map(item=>document.getElementById(item.closest('[role="group"][aria-labelledby]')?.getAttribute('aria-labelledby'))?.textContent)`,
    ),
    [pinned, group],
  )
  await evaluate(`(${energyOptions})[1].focus()`)
  key('Enter')
  await ready(`(${switcher})?.textContent.trim()==='Energy' && (${energyOptions}).length===0`)

  window.setContentSize(1280, 900)
  await click(groupActions)
  await click(menuItem('Delete group'))
  await click(element('[role="dialog"] button', 'Delete group'))
  await ready(`!(${section(group)}) && !!(${actions('Maps')}) && !!(${actions(pinned)})`)
}

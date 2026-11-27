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
    waitFor(() => evaluate<boolean>(script), Boolean).catch(async (cause: unknown) => {
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
  const createGroup = async (name: string) => {
    await click(element('button', 'New group'))
    await ready(`!!document.querySelector('[role="dialog"] input')`)
    await evaluate(`document.querySelector('[role="dialog"] input').focus()`)
    await window.webContents.insertText(name)
    await click(`document.querySelector('[role="dialog"] button[type="submit"]:enabled')`)
    await ready(`!!(${section(name)}) && !document.querySelector('[role="dialog"]')`)
  }
  const deleteGroup = async (name: string) => {
    await click(`document.querySelector('[aria-label="Actions for group ${name}"]')`)
    await click(menuItem('Delete group'))
    await click(element('[role="dialog"] button', 'Delete group'))
    await ready(`!(${section(name)}) && !document.querySelector('[role="dialog"]')`)
  }
  const titles = (sectionName: string) =>
    `[...((${rows(sectionName)})?.querySelectorAll('[data-map-row] > button > span:first-child') ?? [])].map(title => title.textContent).join()`
  const mapButton = (sectionName: string, name: string) =>
    `[...(${rows(sectionName)}).querySelectorAll('[data-map-row] > button')].find(button => button.firstChild.textContent === ${JSON.stringify(name)})`
  const energyDetail = (sectionName: string) =>
    `(${mapButton(sectionName, 'Energy')}).children[1]?.textContent ?? null`
  const block = (sectionName: string) => `(${section(sectionName)}).closest('[data-map-section]')`
  const groupOrder = `[...document.querySelectorAll('[data-map-section="group"] button[aria-controls]')].map(button => button.textContent.trim()).join()`
  type Point = { x: number; y: number }
  const point = (expression: string, fraction = 0.5) =>
    evaluate<Point>(
      `(() => { const box = (${expression}).getBoundingClientRect(); return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height * ${fraction}) } })()`,
    )
  const pointer = (type: 'mouseDown' | 'mouseMove' | 'mouseUp', { x, y }: Point) =>
    window.webContents.sendInputEvent({
      type,
      button: 'left',
      modifiers: type === 'mouseMove' ? ['leftbuttondown'] : [],
      clickCount: 1,
      x,
      y,
    })
  const drag = async (handle: string, target: string, fraction: number, indicator: string) => {
    const from = await point(handle)
    const to = await point(target, fraction)
    window.webContents.sendInputEvent({ type: 'mouseMove', ...from })
    pointer('mouseDown', from)
    pointer('mouseMove', { x: from.x, y: from.y + Math.sign(to.y - from.y) * 6 })
    pointer('mouseMove', to)
    await ready(`${indicator} && !!document.querySelector('[data-map-dragging]')`)
    return to
  }
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

  await createGroup(group)
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
  assert.equal(await evaluate(energyDetail(pinned)), group)
  assert.equal(await evaluate(energyDetail(group)), null)
  const graphTitle = element('[data-slot="sidebar-inner"] button > span:first-child', 'Graph')
  assert.match(
    await evaluate<string>(`(${graphTitle}).nextElementSibling.textContent`),
    /^\d+ concepts?$/,
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
  assert.equal(await evaluate(energyDetail(pinned)), null)
  assert.equal(await evaluate(energyDetail(ungrouped)), null)
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
  await ready(`(${titles(ungrouped)})==='Coffee,Rest'`)
  let release = await drag(
    mapButton(ungrouped, 'Rest'),
    mapButton(ungrouped, 'Coffee'),
    0.25,
    `(${mapButton(ungrouped, 'Coffee')}).parentElement.dataset.drop==='before'`,
  )
  pointer('mouseUp', release)
  await ready(`(${titles(ungrouped)})==='Rest,Coffee' && !document.querySelector('[data-drop]')`)

  const origin = await point(mapButton(ungrouped, 'Coffee'))
  await drag(
    mapButton(ungrouped, 'Coffee'),
    mapButton(ungrouped, 'Rest'),
    0.25,
    `(${mapButton(ungrouped, 'Rest')}).parentElement.dataset.drop==='before'`,
  )
  key('Escape')
  await ready(`!document.querySelector('[data-drop],[data-map-dragging]')`)
  await evaluate(
    `window.__clicked=false;addEventListener('click',()=>{window.__clicked=true},{capture:true,once:true})`,
  )
  pointer('mouseMove', origin)
  pointer('mouseUp', origin)
  await ready('window.__clicked')
  assert.equal(await evaluate(titles(ungrouped)), 'Rest,Coffee')
  assert.equal(await evaluate(`(${mapButton(ungrouped, 'Coffee')}).ariaCurrent`), null)

  const target = await drag(
    mapButton(ungrouped, 'Coffee'),
    mapButton(ungrouped, 'Rest'),
    0.25,
    `(${mapButton(ungrouped, 'Rest')}).parentElement.dataset.drop==='before'`,
  )
  const canvas = { x: target.x + 600, y: target.y }
  pointer('mouseMove', canvas)
  await ready(`!document.querySelector('[data-drop]')`)
  pointer('mouseUp', canvas)
  await ready(`!document.querySelector('[data-map-dragging]')`)
  assert.equal(await evaluate(titles(ungrouped)), 'Rest,Coffee')

  release = await drag(
    mapButton(ungrouped, 'Coffee'),
    section(group),
    0.5,
    `(${block(group)}).dataset.drop==='into'`,
  )
  pointer('mouseUp', release)
  await ready(`(${titles(group)})==='Energy,Coffee' && (${titles(ungrouped)})==='Rest'`)
  assert.equal(await evaluate(`(${section(group)}).getAttribute('aria-expanded')`), 'false')

  release = await drag(
    mapButton(ungrouped, 'Rest'),
    section(group),
    0.5,
    `(${block(group)}).dataset.drop==='into'`,
  )
  pointer('mouseUp', release)
  await ready(`!(${section(ungrouped)}) && !document.querySelector('[data-map-dragging]')`)
  await click(section(group))
  await ready(`(${titles(group)})==='Energy,Coffee,Rest'`)
  const rest = await point(mapButton(group, 'Rest'))
  window.webContents.sendInputEvent({ type: 'mouseMove', ...rest })
  pointer('mouseDown', rest)
  pointer('mouseMove', { x: rest.x, y: rest.y + 6 })
  await ready(`!!(${section(ungrouped)})`)
  const out = await point(section(ungrouped))
  pointer('mouseMove', out)
  await ready(`(${block(ungrouped)}).dataset.drop==='into'`)
  pointer('mouseUp', out)
  await ready(`(${titles(ungrouped)})==='Rest' && (${titles(group)})==='Energy,Coffee'`)

  await createGroup('Work')
  release = await drag(
    section('Work'),
    block(group),
    0.25,
    `(${block(group)}).dataset.drop==='before'`,
  )
  pointer('mouseUp', release)
  await ready(`(${groupOrder})==='Work,${group}'`)

  const coffeeActions = `(${rows(group)}).querySelector('[aria-label="Actions for Coffee"]')`
  await click(coffeeActions)
  await click(menuItem('Move up'))
  await ready(
    `(${titles(group)})==='Coffee,Energy' && document.activeElement===(${coffeeActions}) && !document.querySelector('[role="menu"]')`,
  )

  await deleteGroup('Work')
  await deleteGroup(group)
  await ready(`!!(${actions('Maps')}) && !!(${actions(pinned)})`)
  assert.equal(await evaluate(titles('Maps')), 'Rest,Coffee,Energy')
}

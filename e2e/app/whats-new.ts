import assert from 'node:assert/strict'
import { once } from 'node:events'
import { app, ipcMain, Menu } from 'electron'
import { createTrustedRequest } from '../../electron/ipc.ts'
import { connectMenu } from '../../electron/shell/menu.ts'
import { recordReleaseLaunch } from '../../electron/shell/release-launch.ts'
import { openFixtureWorkspace, waitFor, type CheckContext } from '../helpers.ts'

export async function verifyWhatsNew({ window, url }: CheckContext) {
  await recordReleaseLaunch(app.getPath('userData'), '1.0.0-beta.24')
  connectMenu(createTrustedRequest(url), false)
  ipcMain.handle('plugins:list', () => ({
    value: { safeMode: false, packages: [], incompatible: [], issues: [] },
  }))
  window.setContentSize(1100, 800)
  const { evaluate } = await openFixtureWorkspace({ window, url })
  const button = (label: string, scope = 'document') =>
    `[...${scope}.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(label)})`
  const action = button('See what’s new')
  const dialog = `document.querySelector('[role="dialog"]:not(.settings-popup)')`
  const heading = (version: string) =>
    evaluate<boolean>(
      `[...(${dialog}?.querySelectorAll('h3') ?? [])].some(item => item.textContent === ${JSON.stringify(version)})`,
    )
  const settingsTrigger = `document.querySelector('[data-settings-trigger]')`

  await waitFor(() => evaluate<boolean>(`!!${action}`), Boolean)
  await evaluate(`${action}.click()`)
  await waitFor(() => heading('v1.0.0-beta.25'), Boolean)
  assert.equal(await heading('v1.0.0-beta.24'), false)
  await evaluate(`${button('Close', dialog)}.click()`)

  const reloaded = once(window.webContents, 'did-finish-load')
  window.webContents.reload()
  await reloaded
  await waitFor(
    () =>
      evaluate<boolean>(
        `!document.querySelector('.splash') && !!document.querySelector('#canvas .react-flow')`,
      ),
    Boolean,
  )
  await evaluate('window.nessoWhatsNew.startup()')
  assert.equal(await evaluate(`!!${action}`), false)
  const menuItem = await waitFor(
    async () => Menu.getApplicationMenu()?.getMenuItemById('whatsNew'),
    (item) => item?.enabled === true,
  )
  assert.ok(menuItem)
  await evaluate(`${settingsTrigger}.focus()`)
  menuItem.click(menuItem, window, {})
  await waitFor(() => heading('v1.0.0-beta.24'), Boolean)
  await evaluate(`${button('Close', dialog)}.click()`)
  await waitFor(() => evaluate<boolean>(`document.activeElement === ${settingsTrigger}`), Boolean)

  const settings = `document.querySelector('.settings-popup')`
  await evaluate(`${settingsTrigger}.click()`)
  await waitFor(() => evaluate<boolean>(`!!${settings}`), Boolean)
  await evaluate(`${button('About', settings)}.click()`)
  const aboutAction = button('What’s New', settings)
  await waitFor(() => evaluate<boolean>(`!!${aboutAction}`), Boolean)
  await evaluate(`${aboutAction}.focus(); ${aboutAction}.click()`)
  await waitFor(() => heading('v1.0.0-beta.24'), Boolean)

  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
  await waitFor(() => evaluate<boolean>(`!${dialog}`), Boolean)
  await waitFor(() => evaluate<boolean>(`document.activeElement === ${aboutAction}`), Boolean)
}

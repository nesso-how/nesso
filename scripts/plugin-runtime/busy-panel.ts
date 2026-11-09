import assert from 'node:assert/strict'
import { ipcMain, webContents } from 'electron'
import { createTrustedRequest } from '../../electron/ipc.ts'
import { connectPluginTermination } from '../../electron/plugin-termination.ts'
import {
  chooseTab,
  listExamplePlugin,
  openFixtureWorkspace,
  panelFrame,
  waitFor,
  type CheckContext,
} from './helpers.ts'

export async function verifyBusyPanel(context: CheckContext) {
  await listExamplePlugin()
  connectPluginTermination(ipcMain, createTrustedRequest(false), () =>
    webContents.getAllWebContents(),
  )
  const { evaluate } = await openFixtureWorkspace(context)
  const host = context.window.webContents.mainFrame
  const preloaded = await waitFor(
    async () => host.framesInSubtree.filter((frame) => frame?.url === 'about:srcdoc'),
    (frames) => frames.length === 2,
  )
  const quiz = `!!document.querySelector('.quiz button')`
  await chooseTab(evaluate, 'Concept Quiz')
  const busy = await panelFrame(context.window, quiz)
  const pid = busy.osProcessId
  assert.notEqual(pid, host.osProcessId)
  await busy.executeJavaScript(`setTimeout(()=>{for(;;){}});undefined`)
  await waitFor(
    () => evaluate<boolean>(`!!document.querySelector('[data-plugin-panel] [role="alert"]')`),
    Boolean,
    40_000,
  )
  const exited = async () => {
    try {
      process.kill(pid, 0)
      return false
    } catch {
      return true
    }
  }
  await waitFor(exited, Boolean)
  await waitFor(async () => preloaded.every((frame) => frame.detached), Boolean)
  await chooseTab(evaluate, 'Graph')
  await chooseTab(evaluate, 'Concept Quiz')
  const recovered = await panelFrame(context.window, quiz)
  assert.ok(![pid, host.osProcessId].includes(recovered.osProcessId))
  await chooseTab(evaluate, 'Notes')
  await panelFrame(context.window, `!!document.querySelector('.notes-editor .cm-content')`)
  console.log('desktop: unresponsive panel process terminated and panels reloaded')
}

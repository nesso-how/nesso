import assert from 'node:assert/strict'
import test from 'node:test'
import type { IpcMain, IpcMainEvent } from 'electron'
import { connectPluginTermination } from './plugin-termination.ts'

test('panel termination kills only a trusted panel process outside every host process', () => {
  let handler!: Parameters<IpcMain['on']>[1]
  let trusted = false
  const killed: number[] = []
  const panel = 'nesso://app/plugin-runner/panel.html#guard'
  const host = {
    url: 'nesso://app/',
    osProcessId: 1,
    frames: [
      { url: panel, osProcessId: 2 },
      { url: 'nesso://app/plugin-runner/panel.html#host', osProcessId: 1 },
      { url: 'nesso://app/plugin-runner/panel.html#window', osProcessId: 3 },
    ],
  }
  connectPluginTermination(
    { on: (_channel, listener) => ((handler = listener), {} as IpcMain) },
    () => trusted,
    () => [{ mainFrame: host }, { mainFrame: { osProcessId: 3 } }] as never,
    (pid) => killed.push(pid),
  )
  const event = { sender: { mainFrame: host } } as unknown as IpcMainEvent
  handler(event, panel)
  trusted = true
  for (const url of host.frames.slice(1).map((frame) => frame.url)) handler(event, url)
  assert.deepEqual(killed, [])
  handler(event, panel)
  assert.deepEqual(killed, [2])
})

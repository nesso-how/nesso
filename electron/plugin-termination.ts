import type { IpcMain, WebContents } from 'electron'
import type { TrustedRequest } from './ipc.ts'

export function connectPluginTermination(
  ipc: Pick<IpcMain, 'on'>,
  trusted: TrustedRequest,
  hosts: () => readonly Pick<WebContents, 'mainFrame'>[],
  kill: (pid: number) => void = (pid) => process.kill(pid),
) {
  ipc.on('plugins:terminate', (event, url: unknown) => {
    if (!trusted(event) || typeof url !== 'string') return
    const host = event.sender.mainFrame
    const pid = host.frames.find((frame) => frame.url === url)?.osProcessId
    if (
      !pid ||
      !url.startsWith(new URL('plugin-runner/panel.html#', host.url).href) ||
      hosts().some(({ mainFrame }) => mainFrame.osProcessId === pid)
    )
      return
    try {
      kill(pid)
    } catch {}
  })
}

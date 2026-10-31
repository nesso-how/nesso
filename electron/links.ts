import type { IpcMain, WebContents } from 'electron'
import { ElectronError } from './errors.ts'
import {
  isAllowedNotesLink,
  isAllowedExternalLink,
  isAllowedPluginLink,
} from '../shared/link-policy.ts'
import type { TrustedRequest } from './ipc.ts'

function reportLinkError(error: unknown) {
  console.error(
    new ElectronError([
      {
        path: 'external-link',
        message: error instanceof Error ? error.message : String(error),
      },
    ]),
  )
}

export function connectNotesLinks(
  ipc: Pick<IpcMain, 'handle'>,
  trusted: TrustedRequest,
  openExternal: (url: string) => Promise<void>,
) {
  ipc.handle('notes-link:open', async (event, input: unknown): Promise<boolean> => {
    if (!trusted(event) || typeof input !== 'string' || !isAllowedNotesLink(input)) return false
    try {
      await openExternal(new URL(input).href)
      return true
    } catch (error) {
      reportLinkError(error)
      return false
    }
  })
}

export function connectExternalLinks(
  contents: Pick<WebContents, 'setWindowOpenHandler'>,
  openExternal: (url: string) => Promise<void>,
) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalLink(url) || isAllowedPluginLink(url)) {
      void openExternal(url).catch(reportLinkError)
    }
    return { action: 'deny' }
  })
}

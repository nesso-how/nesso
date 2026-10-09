import type { WebContents } from 'electron'
import { ElectronError } from './errors.ts'
import { isAllowedExternalLink } from '../shared/link-policy.ts'

export function connectExternalLinks(contents: Pick<WebContents, 'setWindowOpenHandler'>, openExternal: (url: string) => Promise<void>) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalLink(url)) {
      void openExternal(url).catch((error: unknown) => {
        console.error(new ElectronError([{ path: 'external-link', message: error instanceof Error ? error.message : String(error) }]))
      })
    }
    return { action: 'deny' }
  })
}

import type { WebContents } from 'electron'
import { ElectronError } from './errors.ts'

export function connectExternalLinks(contents: Pick<WebContents, 'setWindowOpenHandler'>, openExternal: (url: string) => Promise<void>) {
  contents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://github.com/nesso-how/nesso/releases/latest' || url === 'https://github.com/nesso-how/nesso/discussions') {
      void openExternal(url).catch((error: unknown) => {
        console.error(new ElectronError([{ path: 'external-link', message: error instanceof Error ? error.message : String(error) }]))
      })
    }
    return { action: 'deny' }
  })
}

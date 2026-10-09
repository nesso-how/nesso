import type { WebContents } from 'electron'
import { ElectronError } from './errors.ts'

export function connectExternalLinks(contents: Pick<WebContents, 'setWindowOpenHandler'>, openExternal: (url: string) => Promise<void>) {
  contents.setWindowOpenHandler(({ url }) => {
    let destination: URL
    try {
      destination = new URL(url)
    } catch {
      return { action: 'deny' }
    }
    const allowed = destination.origin === 'https://nesso.how'
      || (destination.origin === 'https://github.com' && /^\/nesso-how\/nesso(?:\/|$)/.test(destination.pathname))
    if (allowed && !destination.username && !destination.password) {
      void openExternal(url).catch((error: unknown) => {
        console.error(new ElectronError([{ path: 'external-link', message: error instanceof Error ? error.message : String(error) }]))
      })
    }
    return { action: 'deny' }
  })
}

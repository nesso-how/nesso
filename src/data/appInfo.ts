// SPDX-License-Identifier: MIT
import { isDesktop } from '@/lib/isDesktop'

export const APP_VERSION = __APP_VERSION__

export const REPO_URL = 'https://github.com/nesso-how/nesso'
export const WEBSITE_URL = 'https://nesso.how'
export const DOCS_URL = 'https://nesso.how/docs/introduction'
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`

/** Opens a URL in the system browser on desktop; `window.open` on web. */
export async function openExternal(url: string): Promise<void> {
  if (isDesktop()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url).catch(() => {})
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

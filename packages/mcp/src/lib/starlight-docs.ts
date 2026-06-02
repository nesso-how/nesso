// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface StarlightDocPage {
  slug: string
  title: string
  description: string
  markdown: string
}

const DIST_DIR = fileURLToPath(new URL('..', import.meta.url))

export function loadStarlightDocPages(): StarlightDocPage[] {
  try {
    const raw = readFileSync(join(DIST_DIR, 'starlight-docs.pages.json'), 'utf8')
    return (JSON.parse(raw) as { pages: StarlightDocPage[] }).pages
  } catch (err) {
    throw new Error('Missing starlight-docs.pages.json. Run `pnpm build` in packages/mcp.', {
      cause: err,
    })
  }
}

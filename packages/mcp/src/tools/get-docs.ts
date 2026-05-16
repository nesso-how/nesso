// SPDX-License-Identifier: MIT
import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import { loadStarlightDocPages } from '../lib/starlight-docs.js'

function toc(): string {
  const pages = loadStarlightDocPages()
  const rows = pages.map((p) => `- \`${p.slug}\` — **${p.title}**: ${p.description}`)
  return ['# Nesso documentation — available pages', '', ...rows, '', 'Call get_nesso_docs with a slug to read a page.'].join('\n')
}

export function registerGetDocs(server: McpServer): void {
  server.registerTool(
    'get_nesso_docs',
    {
      description:
        'Nesso docs. Without a slug returns a table of contents (page slugs + descriptions). With a slug returns that page\'s full Markdown.',
      inputSchema: z.object({
        slug: z.string().optional().describe(
          'Page slug to retrieve (e.g. "guides/getting-started"). Omit to list available pages.',
        ),
      }),
    },
    async ({ slug }) => {
      if (!slug) {
        return { content: [{ type: 'text' as const, text: toc() }] }
      }

      const pages = loadStarlightDocPages()
      const page = pages.find((p) => p.slug === slug)

      if (!page) {
        const available = pages.map((p) => p.slug).join(', ')
        return {
          content: [{ type: 'text' as const, text: `Unknown slug "${slug}". Available: ${available}` }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text' as const, text: [`# ${page.title}`, '', page.markdown].join('\n') }],
      }
    },
  )
}

// SPDX-License-Identifier: MIT
// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://nesso.how',
  vite: {
    // `@nesso-how/graph` is linked from the monorepo (see package.json) and would
    // otherwise resolve its own react/react-dom/@xyflow/react from the monorepo's
    // node_modules — a second copy that breaks hooks ("Invalid hook call"). Dedupe
    // forces every consumer to resolve to docs' single copy instead.
    resolve: { dedupe: ['react', 'react-dom', '@xyflow/react'] },
  },
  integrations: [
    react(),
    starlight({
      title: 'Nesso',
      description: 'An app for building typed knowledge graphs for active learning.',
      favicon: '/icon/favicon.svg',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        alt: 'Nesso',
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/nesso-how/nesso' }],
      customCss: ['./src/styles/theme.generated.css', './src/styles/custom.css'],
      components: {
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500;1,9..144,600&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;450;500;600&display=swap',
          },
        },
      ],
      sidebar: [
        { label: 'Introduction', slug: 'docs/introduction' },
        {
          label: 'Guides',
          items: [
            { label: 'Getting started', slug: 'docs/guides/getting-started' },
            { label: 'Concepts & Inspector', slug: 'docs/guides/concepts-and-inspector' },
            { label: 'Review mode', slug: 'docs/guides/review-mode' },
            { label: 'AI mentor', slug: 'docs/guides/ai-mentor' },
            { label: 'MCP', slug: 'docs/guides/mcp-integration' },
            { label: 'Embedding graphs', slug: 'docs/guides/embedding-graphs' },
          ],
        },
        {
          label: 'Reference',
          items: [{ label: 'Relation types', slug: 'docs/reference/relation-types' }],
        },
      ],
    }),
  ],
})

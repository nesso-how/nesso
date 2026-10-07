import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname
const { version } = JSON.parse(readFileSync(resolve(root, '../package.json'), 'utf8')) as { version: string }

export default defineConfig({
  root,
  plugins: [
    {
      name: 'nesso-version',
      transformIndexHtml(html) {
        return html.replaceAll('%NESSO_VERSION%', version)
      },
    },
  ],
})

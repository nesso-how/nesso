import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { defaultLocale, locales } from '@nesso-how/i18n'
import { renderSite } from './i18n.ts'

const root = import.meta.dirname
const stylesheet = new URL('./styles.css', import.meta.url)
const { version } = JSON.parse(readFileSync(resolve(root, '../package.json'), 'utf8')) as { version: string }

export default defineConfig({
  root,
  plugins: [
    {
      name: 'nesso-site',
      configureServer(server) {
        server.watcher.on('change', (file) => {
          if (resolve(file) === fileURLToPath(stylesheet)) server.ws.send({ type: 'full-reload' })
        })
      },
      transformIndexHtml: {
        order: 'pre',
        handler(html, context) {
          const styled = html.replace('{{styles}}', () => readFileSync(stylesheet, 'utf8'))
          if (!context.server) return styled
          const path = new URL(context.originalUrl ?? context.path, 'https://nesso.how').pathname
          const locale = locales.find((language) => path === `/${language}/` || path === `/${language}`) ?? defaultLocale
          return renderSite(styled, locale, version)
        },
      },
      generateBundle: {
        order: 'post',
        handler(_, bundle) {
          const template = bundle['index.html']
          if (template?.type !== 'asset' || typeof template.source !== 'string') return
          const html = template.source
          for (const locale of locales) {
            const source = renderSite(html, locale, version)
            if (locale === defaultLocale) template.source = source
            else this.emitFile({ type: 'asset', fileName: `${locale}/index.html`, source })
          }
        },
      },
    },
  ],
})

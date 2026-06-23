// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { PALETTES } from '@nesso-how/vocab-learning'
import { defaultTheme, themeCss } from '@nesso-how/theme'

const host = process.env.TAURI_DEV_HOST

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }

/**
 * Inject the theme tokens into `<head>` so the CSS variables exist at first
 * paint (before the JS bundle runs), avoiding a flash of unstyled content.
 * `@nesso-how/theme` is the single source of truth; category colours come from
 * the relation-type vocabulary and stay orthogonal to the theme switch.
 */
function nessoTheme(): Plugin {
  const palette = PALETTES[defaultTheme.categoryPalette] ?? PALETTES.default
  const categoryRoot = `:root {\n${Object.entries(palette)
    .map(([cat, hex]) => `  --cat-${cat}: ${hex};`)
    .join('\n')}\n}`
  const css = `${themeCss(defaultTheme)}\n\n${categoryRoot}`
  return {
    name: 'nesso-theme',
    transformIndexHtml() {
      return [{ tag: 'style', attrs: { id: 'nesso-theme' }, children: css, injectTo: 'head' }]
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), nessoTheme()],
  clearScreen: false,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})

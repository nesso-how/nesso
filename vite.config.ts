import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { defineConfig } from 'vite'

export default defineConfig({
  build: { target: 'es2022' },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'bundled-plugins',
      configureServer(server) {
        const roots = [
          'plugins/kernel-theme/src',
          'plugins/paper-theme/src',
          'plugins/mist-theme/src',
          'plugins/base-vocab/src',
          'plugins/import/src',
          'plugins/export/src',
          'packages/plugin/src',
          'packages/core/src',
          'packages/schema/src',
          'packages/i18n/src',
          'packages/ui/src',
        ].map((directory) => path.resolve(import.meta.dirname, directory) + path.sep)
        const manifests = [
          'kernel-theme',
          'paper-theme',
          'mist-theme',
          'base-vocab',
          'import',
          'export',
        ].map((name) => path.resolve(import.meta.dirname, 'plugins', name, 'package.json'))
        const script = path.resolve(import.meta.dirname, 'scripts/build-plugins.ts')
        let timer: ReturnType<typeof setTimeout> | undefined
        let running = false
        let changed = false
        let closed = false
        let child: ReturnType<typeof execFile> | undefined
        const rebuild = () => {
          if (running) {
            changed = true
            return
          }
          running = true
          child = execFile(
            process.execPath,
            [script],
            { cwd: import.meta.dirname },
            (error, _stdout, stderr) => {
              running = false
              if (closed) return
              if (error)
                server.config.logger.error(
                  `Bundled plugin build failed: ${stderr || error.message}`,
                )
              if (changed) {
                changed = false
                rebuild()
              }
            },
          )
        }
        const onChange = (file: string) => {
          if (
            !roots.some((root) => file.startsWith(root)) &&
            !manifests.includes(file) &&
            file !== script &&
            file !== path.resolve(import.meta.dirname, 'shared/plugin-policy.ts') &&
            file !== path.resolve(import.meta.dirname, 'shared/theme-fonts.ts') &&
            file !== path.resolve(import.meta.dirname, 'src/plugins/panel.css')
          )
            return
          clearTimeout(timer)
          timer = setTimeout(rebuild, 50)
        }
        server.watcher.on('change', onChange)
        server.httpServer?.once('close', () => {
          closed = true
          child?.kill()
          clearTimeout(timer)
          server.watcher.off('change', onChange)
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})

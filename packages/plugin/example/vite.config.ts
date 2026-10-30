import { defineConfig } from 'vite'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  root: import.meta.dirname,
  publicDir: false,
  plugins: [cssInjectedByJs()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    target: 'es2022',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    rolldownOptions: { external: /^react(?:-dom)?(?:\/|$)/ },
  },
})

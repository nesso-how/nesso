import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts', 'src/package.ts'],
  platform: 'neutral',
  target: 'es2022',
  tsconfig: '../../tsconfig.plugin.json',
  dts: true,
  deps: {
    alwaysBundle: ['@nesso-how/core', '@nesso-how/errors', '@nesso-how/schema', '@nesso-how/i18n'],
    onlyImport: ['zod', 'semver', 'validate-npm-package-name', 'react'],
  },
})

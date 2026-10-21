import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts', 'src/package.ts'],
  platform: 'neutral',
  target: 'es2022',
  tsconfig: '../../tsconfig.plugin.json',
  dts: true,
  deps: {
    alwaysBundle: ['@nesso/errors', '@nesso/schema', '@nesso/i18n'],
    onlyImport: ['zod', 'semver', 'validate-npm-package-name'],
  },
})

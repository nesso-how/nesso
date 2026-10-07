import type { Plugin, ThemeDefinition } from '@nesso/plugin'

export const kernelTheme: ThemeDefinition = {
  id: 'kernel',
  label: 'Kernel',
}

export const themePlugin: Plugin = {
  kind: 'theme',
  operations: [],
  create: () => kernelTheme,
}

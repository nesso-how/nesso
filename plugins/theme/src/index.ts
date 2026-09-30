import type { Plugin } from '@nesso/plugin'

export const themePlugin: Plugin = () => ({
  themes: [{ id: 'nesso-light', label: 'Nesso Light' }],
})

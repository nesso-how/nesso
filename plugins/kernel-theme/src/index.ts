import type { ThemeDefinition } from '@nesso-how/plugin'

export const create = (): ThemeDefinition => ({
  id: 'kernel-theme',
  colors: {
    background: '#ffffff',
    foreground: '#2f3237',
    canvas: '#fafafb',
    sidebar: '#f4f5f6',
    primary: '#1a202b',
    'primary-hover': '#0f141c',
    'primary-foreground': '#ffffff',
    muted: '#f1f2f4',
    'muted-foreground': '#62666d',
    hover: '#1a202b0a',
    pressed: '#e6e8eb',
    border: '#dcdfe3',
    ring: '#1a202b',
    'selection-halo': '#1a202b24',
    'node-border': '#c9cdd3',
    edge: '#a9aeb6',
    handle: '#80868f',
  },
  metrics: { 'radius-control': 4, 'radius-object': 6, 'duration-state': 140 },
})

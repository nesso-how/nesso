import type { ThemeDefinition } from '@nesso-how/plugin'

export const create = (): ThemeDefinition => ({
  id: 'mist-theme',
  colors: {
    background: '#fbfdff',
    foreground: '#22303f',
    canvas: '#f2f6fa',
    sidebar: '#eaf0f6',
    primary: '#2f5d8a',
    'primary-hover': '#264c71',
    'primary-foreground': '#ffffff',
    muted: '#e6edf3',
    'muted-foreground': '#52677c',
    hover: '#2f5d8a0a',
    pressed: '#dce6ef',
    border: '#d2dde8',
    ring: '#2f5d8a',
    'selection-halo': '#2f5d8a24',
    'node-border': '#b9c9d8',
    edge: '#a9bccf',
    handle: '#6b849c',
  },
  metrics: { 'radius-control': 3, 'radius-object': 5, 'duration-state': 140 },
})

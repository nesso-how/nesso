import type { ThemeDefinition } from '@nesso-how/plugin'
import sansRanges from '@fontsource-variable/geist/unicode.json' with { type: 'json' }
import monoRanges from '@fontsource/ibm-plex-mono/unicode.json' with { type: 'json' }
import { fontFaces } from '../../../shared/theme-fonts.ts'

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
  fonts: {
    sans: fontFaces(sansRanges, 'geist-{subset}-wght-normal', [100, 900]),
    mono: fontFaces(monoRanges, 'ibm-plex-mono-{subset}-400-normal', [400, 400]),
  },
})

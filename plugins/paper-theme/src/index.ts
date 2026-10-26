import type { ThemeDefinition } from '@nesso-how/plugin'
import sansRanges from '@fontsource-variable/geist/unicode.json' with { type: 'json' }
import monoRanges from '@fontsource/ibm-plex-mono/unicode.json' with { type: 'json' }
import { fontFaces } from '../../../shared/theme-fonts.ts'

export const create = (): ThemeDefinition => ({
  id: 'paper-theme',
  colors: {
    background: '#fffdf8', foreground: '#342e29', canvas: '#fbf8f1', sidebar: '#f5f0e8',
    primary: '#934a35', 'primary-hover': '#7b3929', 'primary-foreground': '#fffdf8',
    muted: '#f0e9df', 'muted-foreground': '#74685e', hover: '#6e49300a', pressed: '#e9dfd1',
    border: '#ddd3c5', ring: '#934a35', 'selection-halo': '#934a3524',
    'node-border': '#c7b8a5', edge: '#b9aa98', handle: '#907762',
  },
  metrics: { 'radius-control': 4, 'radius-object': 6, 'duration-state': 140 },
  fonts: { sans: fontFaces(sansRanges, 'geist-{subset}-wght-normal', [100, 900]), mono: fontFaces(monoRanges, 'ibm-plex-mono-{subset}-400-normal', [400, 400]) },
})

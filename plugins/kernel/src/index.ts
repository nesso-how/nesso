import type { ThemeDefinition } from '@nesso/plugin'
import sansRanges from '@fontsource-variable/geist/unicode.json' with { type: 'json' }
import monoRanges from '@fontsource/ibm-plex-mono/unicode.json' with { type: 'json' }

const faces = (ranges: Record<string, string>, stem: string, weight: [number, number]): ThemeDefinition['fonts']['sans'] => ({
  faces: Object.entries(ranges).map(([subset, intervals]) => ({
    path: `fonts/${stem.replace('{subset}', subset)}.woff2`, weight, style: 'normal',
    unicodeRange: intervals.split(',').map((interval): [number, number] => {
      const [from, to = from] = interval.slice(2).split('-')
      return [parseInt(from, 16), parseInt(to, 16)]
    }),
  })),
})

export const create = (): ThemeDefinition => ({
  id: 'kernel',
  colors: {
    background: '#ffffff', foreground: '#292929', canvas: '#ffffff', sidebar: '#f5f5f5',
    primary: '#393939', 'primary-hover': '#202020', 'primary-foreground': '#ffffff',
    muted: '#f2f2f2', 'muted-foreground': '#6b6b6b', hover: '#0000000a', pressed: '#e7e7e7',
    border: '#dedede', ring: '#393939', 'selection-halo': '#39393924',
    'node-border': '#cdcdcd', edge: '#adadad', handle: '#858585',
  },
  metrics: { 'radius-control': 3, 'radius-object': 4, 'duration-state': 140 },
  fonts: { sans: faces(sansRanges, 'geist-{subset}-wght-normal', [100, 900]), mono: faces(monoRanges, 'ibm-plex-mono-{subset}-400-normal', [400, 400]) },
})

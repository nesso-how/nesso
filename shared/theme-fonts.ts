import type { ThemeDefinition } from '@nesso-how/plugin'

export const fontFaces = (
  ranges: Record<string, string>,
  stem: string,
  weight: [number, number],
): ThemeDefinition['fonts']['sans'] => ({
  faces: Object.entries(ranges).map(([subset, intervals]) => ({
    path: `fonts/${stem.replace('{subset}', subset)}.woff2`,
    weight,
    style: 'normal',
    unicodeRange: intervals.split(',').map((interval): [number, number] => {
      const [from, to = from] = interval.slice(2).split('-')
      return [parseInt(from, 16), parseInt(to, 16)]
    }),
  })),
})

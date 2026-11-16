import type { ColorScheme, ThemeDefinition } from '@nesso-how/plugin'

type ThemeTokens = Readonly<
  Record<keyof ThemeDefinition['colors'][ColorScheme] | keyof ThemeDefinition['metrics'], string>
>

export type ThemePresentation = {
  readonly tokens: Readonly<Record<ColorScheme, ThemeTokens>>
}

export function prepareTheme(theme: ThemeDefinition): ThemePresentation {
  const metrics = Object.fromEntries(
    Object.entries(theme.metrics).map(([key, value]) => [
      key,
      `${value}${key === 'duration-state' ? 'ms' : 'px'}`,
    ]),
  )
  return {
    tokens: {
      light: { ...theme.colors.light, ...metrics } as ThemeTokens,
      dark: { ...theme.colors.dark, ...metrics } as ThemeTokens,
    },
  }
}

import type { ThemeDefinition } from '@nesso-how/plugin'

export type ThemePresentation = {
  readonly tokens: Readonly<
    Record<keyof ThemeDefinition['colors'] | keyof ThemeDefinition['metrics'], string>
  >
}

export function prepareTheme(theme: ThemeDefinition): ThemePresentation {
  const tokens: Record<string, string> = { ...theme.colors }
  for (const [key, value] of Object.entries(theme.metrics))
    tokens[key] = `${value}${key === 'duration-state' ? 'ms' : 'px'}`
  return { tokens: tokens as ThemePresentation['tokens'] }
}

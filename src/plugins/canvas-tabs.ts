import type { ActionDescriptor } from '@nesso-how/plugin/runtime'
import type { PluginEntry } from './registry.ts'

export type CanvasTab = ActionDescriptor & { readonly key: string }
export type CanvasTabLayout = {
  readonly available: number
  readonly gap: number
  readonly fixed: number
  readonly more: number
  readonly tabs: readonly number[]
}

export const sameTabLayout = (a: CanvasTabLayout, b: CanvasTabLayout) =>
  a.available === b.available &&
  a.gap === b.gap &&
  a.fixed === b.fixed &&
  a.more === b.more &&
  a.tabs.length === b.tabs.length &&
  a.tabs.every((width, index) => width === b.tabs[index])

export function visibleTabs<T>(
  tabs: readonly T[],
  active: number,
  layout: CanvasTabLayout | null,
): readonly T[] {
  if (!layout || layout.tabs.length !== tabs.length) return tabs
  const { available, gap, fixed, more, tabs: widths } = layout
  const fits = (count: number, extra = 0) =>
    fixed + widths.slice(0, count).reduce((sum, width) => sum + gap + width, 0) + extra <= available
  if (fits(tabs.length)) return tabs
  const overflow = gap + more
  let count = 0
  while (count < tabs.length && fits(count + 1, overflow)) count++
  if (active < count) return tabs.slice(0, count)
  const reserved = overflow + gap + widths[active]
  count = 0
  while (count < active && fits(count + 1, reserved)) count++
  return [...tabs.slice(0, count), tabs[active]]
}

export function canvasTabs(
  plugins: readonly PluginEntry[],
  order: readonly string[] = [],
): CanvasTab[] {
  const rank = new Map(order.map((key, index) => [key, index]))
  return plugins
    .flatMap((plugin) =>
      plugin.kind === 'actions' && !plugin.disabled && !plugin.error
        ? plugin.contribution
            .filter(({ ui }) => ui)
            .map((action) => ({ ...action, key: `${plugin.id}:${action.id}` }))
        : [],
    )
    .sort((a, b) => (rank.get(a.key) ?? order.length) - (rank.get(b.key) ?? order.length))
}

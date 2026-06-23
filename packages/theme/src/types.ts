// SPDX-License-Identifier: MIT
import type { CategoryPalette } from '@nesso-how/vocab-learning'

/**
 * Tokens that change between light and dark mode. A theme pack ships a full
 * `light` set and a `dark` *diff* (see {@link ThemePack.dark}). Category colours
 * are intentionally absent: they belong to the relation-type vocabulary
 * (`@nesso-how/vocab-learning` `PALETTES`) and are referenced by name via
 * {@link ThemePack.categoryPalette}, never duplicated here.
 */
export interface ColorTokens {
  paper: string
  paperDeep: string
  /** 1 = strongest ink, 5 = faintest. Emitted as `--ink`, `--ink-2` … `--ink-5`. */
  ink: { 1: string; 2: string; 3: string; 4: string; 5: string }
  bgElev: string
  bgCard: string
  line: string
  lineStrong: string
  gridDot: string
  accent: string
  highlight: string
  highlightSoft: string
  highlightSelection: string
  /** FSRS recall heatmap / model-status dots, cool→warm. Emitted as `--conf-1` … `--conf-5`. */
  recall: { 1: string; 2: string; 3: string; 4: string; 5: string }
}

export interface ShadowTokens {
  md: string
  lg: string
  dropLg: string
}

/** The mode-varying half of a theme: colour + elevation. */
export interface ModeTokens {
  color: ColorTokens
  shadow: ShadowTokens
}

export interface FontTokens {
  display: string
  sans: string
  mono: string
  featureSettings: string
}

export type TypeStep = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl'

export interface TypeScale {
  size: Record<TypeStep, string>
  weight: { regular: number; medium: number; semibold: number }
  leading: { tight: number; normal: number }
}

export type SpaceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Spacing ramp. Step `0` is `0`; subsequent steps grow on the audited rhythm. */
export type SpaceScale = Record<SpaceStep, string>

/**
 * Border radii. `sm`…`xl` are ramp steps; `pill` and `circle` are *shape
 * primitives* ("half the height" and `50%`), not rungs of the numeric scale.
 */
export interface RadiiScale {
  none: string
  sm: string
  md: string
  lg: string
  xl: string
  pill: string
  circle: string
}

/**
 * A complete, selectable visual identity. Mode-invariant axes (`font`, `type`,
 * `space`, `radii`) sit at the top level; only `light`/`dark` vary by mode, so
 * the matrix never doubles typography or spacing.
 */
export interface ThemePack {
  id: string
  name: string
  /** Default category palette this pack pairs with; the palette switch stays orthogonal. */
  categoryPalette: CategoryPalette
  font: FontTokens
  type: TypeScale
  space: SpaceScale
  radii: RadiiScale
  light: ModeTokens
  /** Diff applied over `light` to produce dark mode; specify only what changes. */
  dark: DeepPartial<ModeTokens>
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/** Partial override accepted by `defineTheme` when deriving a pack from a base. */
export type ThemeOverride = DeepPartial<Omit<ThemePack, 'id' | 'name'>> & {
  id: string
  name: string
}

export type ThemeMode = 'light' | 'dark'

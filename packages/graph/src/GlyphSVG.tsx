// SPDX-License-Identifier: MIT
import { GLYPH_PATHS } from '@nesso-how/relation-types'
import type { GlyphKind } from '@nesso-how/relation-types'

interface Props {
  kind: GlyphKind
  color?: string
  size?: number
}

/** Renders a relation glyph from `@nesso-how/relation-types`' framework-agnostic SVG data. */
export function GlyphSVG({ kind, color = 'currentColor', size = 14 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      style={{ color }}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      stroke="currentColor"
      dangerouslySetInnerHTML={{ __html: GLYPH_PATHS[kind] }}
    />
  )
}

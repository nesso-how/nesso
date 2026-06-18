// SPDX-License-Identifier: MIT
import type { MouseEvent } from 'react'

interface HoverVars {
  background?: string
  color?: string
}

/**
 * Pointer handlers that swap inline `background`/`color` between a hover and a
 * rest state directly on the DOM node, so hovering does not trigger a React
 * re-render. Spread onto an element: `{...hoverStyle(hover, rest)}`.
 */
export function hoverStyle(hover: HoverVars, rest: HoverVars) {
  const apply = (vars: HoverVars) => (e: MouseEvent<HTMLElement>) => {
    if (vars.background !== undefined) e.currentTarget.style.background = vars.background
    if (vars.color !== undefined) e.currentTarget.style.color = vars.color
  }
  return { onMouseEnter: apply(hover), onMouseLeave: apply(rest) }
}

// SPDX-License-Identifier: MIT
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'

/** Which vertical edge of the panel the handle straddles. Right-docked panels
 *  (inspector) put the handle on the LEFT edge; left-docked panels (sidebar)
 *  put it on the RIGHT edge. */
export type ResizeHandleSide = 'left' | 'right'

interface Props {
  side: ResizeHandleSide
  ariaLabel: string
  title?: string
  /** Slider-role value attributes. The sidebar handle omits them; the
   *  inspector handle sets all three — pass nothing to render neither. */
  valueNow?: number
  valueMin?: number
  valueMax?: number
  onMouseDown: (e: ReactMouseEvent) => void
  onKeyDown: (e: ReactKeyboardEvent) => void
}

/** Shared drag-resize handle for resizable side panels. Positioning mirrors by
 *  `side` (`right: -4` vs `left: -4`); all other styles are identical. */
export function ResizeHandle({
  side,
  ariaLabel,
  title,
  valueNow,
  valueMin,
  valueMax,
  onMouseDown,
  onKeyDown,
}: Props) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      title={title}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        ...(side === 'right' ? { right: -4 } : { left: -4 }),
        width: 8,
        cursor: 'col-resize',
        touchAction: 'none',
        background: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
      }}
    />
  )
}

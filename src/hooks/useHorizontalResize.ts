// SPDX-License-Identifier: MIT
import { useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'

const KEYBOARD_STEP = 12

/** Drag/arrow-key resize for vertical panel edges (sidebar, inspector).
 *  `invert` is for handles on the panel's LEFT edge (right-docked panels):
 *  dragging left then widens the panel. */
export function useHorizontalResize(
  width: number,
  onWidthChange: (w: number) => void,
  clamp: (w: number) => number,
  invert = false,
) {
  const [isResizing, setIsResizing] = useState(false)

  function onResizeHandleMouseDown(e: MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    setIsResizing(true)
    function onMove(ev: globalThis.MouseEvent) {
      const delta = ev.clientX - startX
      onWidthChange(clamp(startW + (invert ? -delta : delta)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      setIsResizing(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function onResizeHandleKeyDown(e: ReactKeyboardEvent) {
    const step = invert ? -KEYBOARD_STEP : KEYBOARD_STEP
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onWidthChange(clamp(width - step))
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onWidthChange(clamp(width + step))
    }
  }

  return { isResizing, onResizeHandleMouseDown, onResizeHandleKeyDown }
}

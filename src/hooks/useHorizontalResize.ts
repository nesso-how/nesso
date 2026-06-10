// SPDX-License-Identifier: MIT
import { useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'

const KEYBOARD_STEP = 12

/** Drag/arrow-key resize for vertical panel edges (sidebar, inspector). */
export function useHorizontalResize(
  width: number,
  onWidthChange: (w: number) => void,
  clamp: (w: number) => number,
) {
  const [isResizing, setIsResizing] = useState(false)

  function onResizeHandleMouseDown(e: MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    setIsResizing(true)
    function onMove(ev: globalThis.MouseEvent) {
      onWidthChange(clamp(startW + ev.clientX - startX))
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
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onWidthChange(clamp(width - KEYBOARD_STEP))
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onWidthChange(clamp(width + KEYBOARD_STEP))
    }
  }

  return { isResizing, onResizeHandleMouseDown, onResizeHandleKeyDown }
}

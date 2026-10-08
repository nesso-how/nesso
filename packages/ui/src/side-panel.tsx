import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from 'cn'
import { PanelToggle } from './panel-toggle'

export function SidePanel({ id, side, open, size, minSize, maxSize, onToggle, onSizeChange, toggleLabel, resizeLabel, className, children }: {
  id: string
  side: 'left' | 'right'
  open: boolean
  size: number
  minSize: number
  maxSize: number | `${number}%`
  onToggle: () => void
  onSizeChange: (size: number) => void
  toggleLabel: string
  resizeLabel: string
  className?: string
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; position: number; size: number } | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [dragSize, setDragSize] = useState<number | null>(null)
  const direction = side === 'left' ? 1 : -1
  const limit = typeof maxSize === 'number' ? maxSize : available === null ? size : available * parseFloat(maxSize) / 100
  const maximum = Math.max(minSize, Math.min(limit, available ?? limit))
  const clamp = (value: number) => Math.min(maximum, Math.max(minSize, value))
  const currentSize = clamp(dragSize ?? size)

  useLayoutEffect(() => {
    const parent = root.current?.parentElement
    if (!parent) return
    const measure = () => setAvailable(parent.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  const pointerSize = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) return null
    return clamp(start.size + (event.clientX - start.position) * direction)
  }

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight']
    if (event.key === 'Home') onSizeChange(minSize)
    else if (event.key === 'End') onSizeChange(maximum)
    else if (keys.includes(event.key)) onSizeChange(clamp(currentSize + (event.key === keys[1] ? 10 : -10) * direction))
    else return
    event.preventDefault()
  }

  const cancelResize = () => {
    drag.current = null
    setDragSize(null)
  }

  return (
    <div ref={root} className={cn('side-panel', className)} data-side={side} data-open={open} data-resizing={dragSize !== null || undefined} style={{ '--panel-size': `${currentSize}px` } as CSSProperties}>
      <div id={id} className="side-panel-content" inert={!open} aria-hidden={!open}>{children}</div>
      <div
        className="side-panel-resize"
        role="separator"
        tabIndex={open ? 0 : -1}
        aria-label={resizeLabel}
        aria-controls={id}
        aria-orientation="vertical"
        aria-valuemin={minSize}
        aria-valuemax={maximum}
        aria-valuenow={currentSize}
        onKeyDown={resizeWithKeyboard}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { pointerId: event.pointerId, position: event.clientX, size: currentSize }
          setDragSize(currentSize)
        }}
        onPointerMove={(event) => {
          const next = pointerSize(event)
          if (next !== null) setDragSize(next)
        }}
        onPointerUp={(event) => {
          const next = pointerSize(event)
          if (next === null) return
          cancelResize()
          onSizeChange(next)
        }}
        onPointerCancel={cancelResize}
        onLostPointerCapture={cancelResize}
      />
      <PanelToggle side={side} open={open} aria-label={toggleLabel} aria-controls={id} title={toggleLabel} onClick={onToggle} />
    </div>
  )
}

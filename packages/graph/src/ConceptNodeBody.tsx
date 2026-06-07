// SPDX-License-Identifier: MIT
import type { CSSProperties, MouseEventHandler, ReactNode, Ref } from 'react'
import { ratingColor } from './ratingColor.js'

export interface ConceptNodeBodyProps {
  text: string
  selected: boolean
  showHeatmap: boolean
  showConfidence: boolean
  lastRating: number
  reps: number
  due: number
  cursor?: CSSProperties['cursor']
  userSelect?: CSSProperties['userSelect']
  className?: string
  connectionTarget?: boolean
  hideUnderline?: boolean
  rootRef?: Ref<HTMLDivElement>
  onDoubleClick?: MouseEventHandler<HTMLDivElement>
  /** Replaces the default label span (e.g. inline edit overlay). */
  children?: ReactNode
}

export function ConceptNodeBody({
  text,
  selected,
  showHeatmap,
  showConfidence,
  lastRating,
  reps,
  due,
  cursor = 'default',
  userSelect = 'none',
  className,
  connectionTarget = false,
  hideUnderline = false,
  rootRef,
  onDoubleClick,
  children,
}: ConceptNodeBodyProps) {
  const heatTint = ratingColor(lastRating)
  const confColor = showConfidence ? heatTint : 'var(--ink, #1a1a1a)'
  const isStale = reps > 0 && due <= Date.now()

  return (
    <div
      ref={rootRef}
      className={className}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'relative',
        padding: '6px 14px',
        borderRadius: 999,
        background: selected || showHeatmap ? 'var(--bg-card, #f5f5f5)' : 'transparent',
        border:
          selected || showHeatmap ? '0.5px solid var(--line, #d0d0d0)' : '0.5px solid transparent',
        cursor,
        userSelect,
        minWidth: 60,
      }}
    >
      {showHeatmap && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: heatTint,
            opacity: 0.14,
            pointerEvents: 'none',
          }}
        />
      )}

      {selected && (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 999,
            border: '1px dashed var(--accent, #3b82f6)',
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        />
      )}

      {connectionTarget && (
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 999,
            border: '1.5px dotted color-mix(in srgb, var(--accent, #3b82f6) 65%, transparent)',
            pointerEvents: 'none',
          }}
        />
      )}

      {children ?? (
        <span
          style={{
            font: '500 16px Fraunces, ui-serif, Georgia, serif',
            letterSpacing: '-0.005em',
            color: 'var(--ink, #1a1a1a)',
            display: 'block',
            whiteSpace: 'pre',
          }}
        >
          {text}
        </span>
      )}

      {!hideUnderline && (
        <div
          style={{
            position: 'absolute',
            bottom: 5,
            left: 16,
            right: 16,
            height: selected ? 1.4 : 0.8,
            background:
              isStale && showConfidence
                ? `repeating-linear-gradient(90deg, ${confColor} 0, ${confColor} 4px, transparent 4px, transparent 8px)`
                : confColor,
            opacity: selected ? 0.9 : 0.55,
          }}
        />
      )}
    </div>
  )
}

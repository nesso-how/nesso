// SPDX-License-Identifier: MIT
import type { CSSProperties, MouseEventHandler, ReactNode, Ref } from 'react'
import { NODE_DIMMED_OPACITY } from './edgeHighlight.js'
import { ratingColor } from './ratingColor.js'

/** Absolute decoration rings and the heatmap tint behind the concept label.
 * The dashed ring marks the selected concept and, during connect/reconnect
 * drags, the destination concept — one shared highlight for both. */
function ConceptOverlays({
  showHeatmap,
  heatTint,
  selected,
  connectionTarget,
}: {
  showHeatmap: boolean
  heatTint: string
  selected: boolean
  connectionTarget: boolean
}) {
  return (
    <>
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

      {(selected || connectionTarget) && (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 999,
            border: '1px dashed var(--accent)',
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  )
}

export interface ConceptNodeBodyProps {
  text: string
  selected: boolean
  showHeatmap: boolean
  lastRating: number
  cursor?: CSSProperties['cursor']
  userSelect?: CSSProperties['userSelect']
  className?: string
  /** Highlights the concept with the selection ring while a connect or
   * reconnect drag hovers it as the destination. */
  connectionTarget?: boolean
  /** Fades the concept while another map element holds the focus. */
  dimmed?: boolean
  rootRef?: Ref<HTMLDivElement>
  onDoubleClick?: MouseEventHandler<HTMLDivElement>
  /** Replaces the default label span (e.g. inline edit overlay). */
  children?: ReactNode
}

export function ConceptNodeBody({
  text,
  selected,
  showHeatmap,
  lastRating,
  cursor = 'default',
  userSelect = 'none',
  className,
  connectionTarget = false,
  dimmed = false,
  rootRef,
  onDoubleClick,
  children,
}: ConceptNodeBodyProps) {
  const heatTint = ratingColor(lastRating)

  return (
    <div
      ref={rootRef}
      className={className}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'relative',
        padding: '6px 14px',
        borderRadius: 999,
        background: selected || showHeatmap ? 'var(--bg-card)' : 'transparent',
        border: selected || showHeatmap ? '0.5px solid var(--line)' : '0.5px solid transparent',
        cursor,
        userSelect,
        minWidth: 60,
        opacity: dimmed ? NODE_DIMMED_OPACITY : undefined,
      }}
    >
      <ConceptOverlays
        showHeatmap={showHeatmap}
        heatTint={heatTint}
        selected={selected}
        connectionTarget={connectionTarget}
      />

      {children ?? (
        <span
          style={{
            font: '500 16px Fraunces, ui-serif, Georgia, serif',
            letterSpacing: '-0.005em',
            color: 'var(--ink)',
            display: 'block',
            whiteSpace: 'pre',
          }}
        >
          {text}
        </span>
      )}
    </div>
  )
}

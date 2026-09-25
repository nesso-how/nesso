// SPDX-License-Identifier: MIT
import { useId, type ReactNode } from 'react'

/** Shared endpoint marker for reconnect and connection-creation previews. */
export function EdgeEndpointDot({
  x,
  y,
  active,
  hidden = false,
  children,
}: {
  x: number
  y: number
  active: boolean
  /** Hide the visual dot without unmounting the hit circle during pointer capture. */
  hidden?: boolean
  children?: ReactNode
}) {
  const gradientId = useId().replace(/:/g, '')
  return (
    <g style={{ opacity: hidden ? 0 : 1 }}>
      <g style={{ opacity: active ? 0.45 : 0.18, transition: 'opacity 180ms ease-in-out' }}>
        <defs>
          <radialGradient id={`${gradientId}-halo`}>
            <stop offset="75%" stopColor="var(--bg-card, #fff)" />
            <stop offset="100%" stopColor="var(--bg-card, #fff)" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${gradientId}-dot`}>
            <stop offset="75%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle
          cx={x}
          cy={y}
          r={active ? 6 : 7}
          fill={active ? 'var(--bg-card, #fff)' : `url(#${gradientId}-halo)`}
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={x}
          cy={y}
          r={active ? 6 : 7}
          fill={active ? 'var(--accent)' : `url(#${gradientId}-dot)`}
          style={{ pointerEvents: 'none' }}
        />
      </g>
      {children}
    </g>
  )
}

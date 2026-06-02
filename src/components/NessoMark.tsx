// SPDX-License-Identifier: MIT
import type { CSSProperties } from 'react'

/**
 * Nexus brandmark (central node + peripheral connections).
 * Peripheral nodes/lines follow `currentColor`; hub uses `--accent` from the active theme.
 */
export function NessoMark({
  size = 24,
  title,
  style,
}: {
  size?: number
  /** Optional accessible name; omit when decorative next to a text label */
  title?: string
  style?: CSSProperties
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={style}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <line
        x1="32"
        y1="32"
        x2="32"
        y2="9"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="32"
        x2="55"
        y2="21"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="32"
        x2="49"
        y2="50"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="32"
        x2="16"
        y2="52"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="32"
        x2="10"
        y2="26"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="9" r="5.5" fill="currentColor" />
      <circle cx="55" cy="21" r="5.5" fill="currentColor" />
      <circle cx="49" cy="50" r="5.5" fill="currentColor" />
      <circle cx="16" cy="52" r="5.5" fill="currentColor" />
      <circle cx="10" cy="26" r="5.5" fill="currentColor" />
      <circle cx="32" cy="32" r="8" fill="var(--accent)" />
    </svg>
  )
}

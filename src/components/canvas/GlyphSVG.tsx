// SPDX-License-Identifier: MIT
import type { GlyphKind } from '@/types/graph'

interface Props {
  kind: GlyphKind
  color?: string
  size?: number
}

export function GlyphSVG({ kind, color = 'currentColor', size = 14 }: Props) {
  const c = color
  const sw = 1.4
  const common = {
    fill: 'none' as const,
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const v = `0 0 ${size} ${size}`
  const s = size
  switch (kind) {
    case 'triangle-up':
      return (
        <svg width={s} height={s} viewBox={v}>
          <polygon
            points={`${s / 2},${(s * 3) / 14} ${(s * 11) / 14},${(s * 10) / 14} ${(s * 3) / 14},${(s * 10) / 14}`}
            fill={c}
          />
        </svg>
      )
    case 'circle-dot':
      return (
        <svg width={s} height={s} viewBox={v}>
          <circle cx={s / 2} cy={s / 2} r={(s * 5) / 14} {...common} />
          <circle cx={s / 2} cy={s / 2} r={(s * 1.6) / 14} fill={c} />
        </svg>
      )
    case 'diamond':
      return (
        <svg width={s} height={s} viewBox={v}>
          <polygon
            points={`${s / 2},${(s * 2) / 14} ${(s * 12) / 14},${s / 2} ${s / 2},${(s * 12) / 14} ${(s * 2) / 14},${s / 2}`}
            fill={c}
          />
        </svg>
      )
    case 'diamond-open':
      return (
        <svg width={s} height={s} viewBox={v}>
          <polygon
            points={`${s / 2},${(s * 2) / 14} ${(s * 12) / 14},${s / 2} ${s / 2},${(s * 12) / 14} ${(s * 2) / 14},${s / 2}`}
            {...common}
          />
        </svg>
      )
    case 'hash':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M5 2v10M9 2v10M2 5h10M2 9h10" {...common} />
        </svg>
      )
    case 'arrow-right':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M2 7h10M8 3l4 4-4 4" {...common} />
        </svg>
      )
    case 'asterisk':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M7 2v10M3 4l8 6M3 10l8-6" {...common} />
        </svg>
      )
    case 'key':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <circle cx="5" cy="7" r="2.4" {...common} />
          <path d="M7.4 7H12M10 7v2M11.5 7v1.5" {...common} />
        </svg>
      )
    case 'block':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="4.5" {...common} />
          <path d="M3.7 3.7l6.6 6.6" {...common} />
        </svg>
      )
    case 'spark':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path
            d="M7 2v3M7 9v3M2 7h3M9 7h3M3.5 3.5l2 2M8.5 8.5l2 2M3.5 10.5l2-2M8.5 5.5l2-2"
            {...common}
          />
        </svg>
      )
    case 'anchor':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <circle cx="7" cy="4" r="1.5" {...common} />
          <path d="M7 5.5v6.5M3 9c0 2 2 3 4 3s4-1 4-3M4.5 8.5h5" {...common} />
        </svg>
      )
    case 'tool':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M9 2.5L11.5 5l-1.2 1.2-2.5-2.5zM10.3 6.2l-7 7-1.5-1.5 7-7" {...common} />
        </svg>
      )
    case 'chevron-r':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M5 3l4 4-4 4M2 3l4 4-4 4" {...common} />
        </svg>
      )
    case 'ring':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="4.5" {...common} />
        </svg>
      )
    case 'tilde':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M2 8 Q4 5 7 7 T12 6" {...common} />
        </svg>
      )
    case 'x':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path
            d="M3 3l8 8M11 3l-8 8"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )
    case 'minus':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M3 7h8" stroke={c} strokeWidth={2} strokeLinecap="round" fill="none" />
        </svg>
      )
    case 'flag':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M4 12V2M4 2l7 3.5L4 9" {...common} />
        </svg>
      )
    case 'approx':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M2 5 Q4 3 7 5 T12 5" {...common} />
          <path d="M2 9 Q4 7 7 9 T12 9" {...common} />
        </svg>
      )
    case 'arrows-lr':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M2 7h10M3.5 4.5L2 7l1.5 2.5M10.5 4.5L12 7l-1.5 2.5" {...common} />
        </svg>
      )
    case 'check':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M2.5 7.5l3 3 6-7" {...common} />
        </svg>
      )
    case 'slash':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M11 3l-8 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        </svg>
      )
    case 'bulb':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path
            d="M7 2a3.2 3.2 0 0 0-2 5.7c.4.4.7.9.7 1.5v.3h2.6v-.3c0-.6.3-1.1.7-1.5A3.2 3.2 0 0 0 7 2zM5.7 10.5h2.6M6.2 12h1.6"
            {...common}
          />
        </svg>
      )
    case 'equals':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path
            d="M3 5.5h8M3 8.5h8"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )
    case 'lock':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <rect x="3.5" y="6.5" width="7" height="5.5" rx="0.8" {...common} />
          <path d="M5 6.5V4.5a2 2 0 0 1 4 0v2" {...common} />
        </svg>
      )
    case 'flame':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path
            d="M7 2c-1 2.2-3 3.4-3 6a3 3 0 0 0 6 0c0-1.2-.6-2-1.4-2.6.2 1.2-.4 2.2-1.4 2C7.4 5.6 7.8 4 7 2z"
            {...common}
          />
        </svg>
      )
    case 'hourglass':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path
            d="M3.5 2.5h7M3.5 11.5h7M4 2.5v1.5L7 7l3-3V2.5M4 11.5v-1.5L7 7l3 3v1.5"
            {...common}
          />
        </svg>
      )
    case 'brackets':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M4 3h-1.5v8H4M10 3h1.5v8H10" {...common} />
        </svg>
      )
    case 'overlap':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path
            d="M2 5.5h7M5 8.5h7"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )
    case 'branch':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M7 2v10M7 7l-3 3M7 7l3 3" {...common} />
        </svg>
      )
    default:
      return null
  }
}

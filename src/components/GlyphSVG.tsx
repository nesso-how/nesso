import type { GlyphKind } from '@/types/graph'

interface Props {
  kind: GlyphKind
  color?: string
  size?: number
}

export function GlyphSVG({ kind, color = 'currentColor', size = 14 }: Props) {
  const c = color
  const sw = 1.4
  const common = { fill: 'none' as const, stroke: c, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const v = `0 0 ${size} ${size}`
  const s = size
  switch (kind) {
    case 'triangle-up':  return <svg width={s} height={s} viewBox={v}><polygon points={`${s/2},${s*3/14} ${s*11/14},${s*10/14} ${s*3/14},${s*10/14}`} fill={c} /></svg>
    case 'circle-dot':   return <svg width={s} height={s} viewBox={v}><circle cx={s/2} cy={s/2} r={s*5/14} {...common} /><circle cx={s/2} cy={s/2} r={s*1.6/14} fill={c} /></svg>
    case 'diamond':      return <svg width={s} height={s} viewBox={v}><polygon points={`${s/2},${s*2/14} ${s*12/14},${s/2} ${s/2},${s*12/14} ${s*2/14},${s/2}`} fill={c} /></svg>
    case 'diamond-open': return <svg width={s} height={s} viewBox={v}><polygon points={`${s/2},${s*2/14} ${s*12/14},${s/2} ${s/2},${s*12/14} ${s*2/14},${s/2}`} {...common} /></svg>
    case 'hash':         return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M5 2v10M9 2v10M2 5h10M2 9h10" {...common} /></svg>
    case 'arrow-right':  return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M2 7h10M8 3l4 4-4 4" {...common} /></svg>
    case 'asterisk':     return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M7 2v10M3 4l8 6M3 10l8-6" {...common} /></svg>
    case 'key':          return <svg width={s} height={s} viewBox="0 0 14 14"><circle cx="5" cy="7" r="2.4" {...common} /><path d="M7.4 7H12M10 7v2M11.5 7v1.5" {...common} /></svg>
    case 'block':        return <svg width={s} height={s} viewBox="0 0 14 14"><circle cx="7" cy="7" r="4.5" {...common} /><path d="M3.7 3.7l6.6 6.6" {...common} /></svg>
    case 'spark':        return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M7 2v3M7 9v3M2 7h3M9 7h3M3.5 3.5l2 2M8.5 8.5l2 2M3.5 10.5l2-2M8.5 5.5l2-2" {...common} /></svg>
    case 'anchor':       return <svg width={s} height={s} viewBox="0 0 14 14"><circle cx="7" cy="4" r="1.5" {...common} /><path d="M7 5.5v6.5M3 9c0 2 2 3 4 3s4-1 4-3M4.5 8.5h5" {...common} /></svg>
    case 'tool':         return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M9 2.5L11.5 5l-1.2 1.2-2.5-2.5zM10.3 6.2l-7 7-1.5-1.5 7-7" {...common} /></svg>
    case 'chevron-r':    return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M5 3l4 4-4 4M2 3l4 4-4 4" {...common} /></svg>
    case 'ring':         return <svg width={s} height={s} viewBox="0 0 14 14"><circle cx="7" cy="7" r="4.5" {...common} /></svg>
    case 'tilde':        return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M2 8 Q4 5 7 7 T12 6" {...common} /></svg>
    case 'x':            return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" fill="none" /></svg>
    default: return null
  }
}

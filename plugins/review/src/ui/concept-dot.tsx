import { conceptColor } from '@nesso-how/ui'

export function ConceptDot({ color }: { color?: string }) {
  return (
    <span
      className="review-dot"
      style={{ background: color ? conceptColor(color).background : 'var(--muted)' }}
      aria-hidden="true"
    />
  )
}

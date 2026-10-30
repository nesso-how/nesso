export function ConceptDot({ color }: { color?: string }) {
  return (
    <span
      className="review-dot"
      style={{ background: color ?? 'var(--muted)' }}
      aria-hidden="true"
    />
  )
}

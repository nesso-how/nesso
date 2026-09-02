// SPDX-License-Identifier: MIT
interface Props {
  onClick: () => void
  large?: boolean
  /** Optional accessible name; the ✕ glyph alone carries no meaning to screen readers. */
  label?: string
}

export function CloseButton({ onClick, large, label }: Props) {
  const size = large ? 28 : 22
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        appearance: 'none',
        border: 0,
        background: 'transparent',
        color: 'var(--ink-4)',
        cursor: 'pointer',
        width: size,
        height: size,
        borderRadius: 'var(--radius-pill)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `500 ${large ? 13 : 12}px 'Inter', system-ui`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--ink-2)'
        e.currentTarget.style.background = 'var(--paper-deep)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--ink-4)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      ✕
    </button>
  )
}

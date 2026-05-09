// SPDX-License-Identifier: MIT
interface Props {
  onClick: () => void
}

export function CloseButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 'none', background: 'transparent',
        color: 'var(--ink-4)', cursor: 'default',
        padding: 4, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--paper-deep)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 2l10 10M12 2L2 12" />
      </svg>
    </button>
  )
}

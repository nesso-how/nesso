// SPDX-License-Identifier: MIT
import { useT } from '@/i18n'

interface Props {
  onSearch: () => void
}

export function SidebarSearchButton({ onSearch }: Props) {
  const t = useT()

  return (
    <div style={{ padding: '10px 12px 8px', flexShrink: 0 }}>
      <button
        onClick={onSearch}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 9,
          appearance: 'none',
          border: 0,
          background: 'var(--paper-deep)',
          borderRadius: 'var(--radius-md)',
          padding: '7px 10px',
          cursor: 'pointer',
          fontSize: '12.5px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-4)',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L13 13" strokeLinecap="round" />
        </svg>
        {t.sidebar.search}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
          }}
        >
          ⌘K
        </span>
      </button>
    </div>
  )
}

// SPDX-License-Identifier: MIT
import { useT } from '@/i18n'
import { NessoMark } from '../NessoMark'
import { TOPBAR_HEIGHT_PX } from '../TopBar'
import { WEBSITE_URL } from '@/data/appInfo'
import { iconBtn } from './sidebarStyles'

interface Props {
  onCollapse: () => void
}

export function SidebarHeader({ onCollapse }: Props) {
  const t = useT()

  return (
    <div
      style={{
        height: TOPBAR_HEIGHT_PX,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-5)',
        borderBottom: '0.5px solid var(--line)',
        flexShrink: 0,
      }}
    >
      <a
        href={WEBSITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={t.sidebar.websiteLinkTitle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-5)',
          flexShrink: 0,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div style={{ flexShrink: 0, color: 'var(--ink)', lineHeight: 0 }} aria-hidden>
          <NessoMark size={26} />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--text-xl)',
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}
        >
          Nesso
        </div>
      </a>
      <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
      <button
        onClick={onCollapse}
        title={t.sidebar.collapseSidebar}
        type="button"
        style={iconBtn}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--ink)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--ink-3)'
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M10 4l-4 4 4 4" />
        </svg>
      </button>
    </div>
  )
}

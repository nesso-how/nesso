// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store/graph'
import { GraphSwitcher } from './GraphSwitcher'
import { GraphIO } from './GraphIO'

interface Props {
  onReview: () => void
  onShortcuts: () => void
  onSettings: () => void
  onRelationTypes: () => void
  onSearch: () => void
}

export function TopBar({ onReview, onShortcuts, onSettings, onRelationTypes, onSearch }: Props) {
  const { settings, setSetting } = useGraphStore()
  const dark = settings.dark

  return (
    <>
      {/* Centered nav pill */}
      <div style={{
        position: 'absolute',
        top: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--bg-elev)',
        border: '0.5px solid var(--line)',
        borderRadius: 999,
        padding: '6px 8px 6px 18px',
        boxShadow: 'var(--shadow-md)',
        whiteSpace: 'nowrap',
      }}>
        <div style={{
          font: "600 17px 'Fraunces', ui-serif, Georgia, serif",
          letterSpacing: '-0.01em',
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 6,
        }}>
          Nesso
          <i style={{ fontStyle: 'italic', color: 'var(--cat-causal)', fontWeight: 500 }}>·</i>
        </div>

        <GraphSwitcher />

        <button
          onClick={onSearch}
          style={{
            appearance: 'none', border: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            height: 28,
            background: 'var(--paper-deep)',
            borderRadius: 999,
            color: 'var(--ink-3)',
            fontSize: 12,
            minWidth: 200,
            cursor: 'default',
          }}
        >
          <span>Search concepts…</span>
          <kbd style={{
            marginLeft: 'auto',
            font: "500 10px 'JetBrains Mono', ui-monospace",
            background: 'var(--bg-elev)',
            padding: '1px 5px',
            borderRadius: 4,
            color: 'var(--ink-4)',
          }}>⌘K</kbd>
        </button>
      </div>

      {/* Top-right action pill */}
      <div style={{
        position: 'absolute',
        top: 18,
        right: 18,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--bg-elev)',
        border: '0.5px solid var(--line)',
        borderRadius: 999,
        padding: 5,
        boxShadow: 'var(--shadow-md)',
      }}>
        <GraphIO />

        <TopBarBtn title="Relation types" onClick={onRelationTypes}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M2 4.5h10M2 8h10M2 11.5h6" />
          </svg>
        </TopBarBtn>

        <TopBarBtn title="Review (R)" onClick={onReview}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" /><path d="M2.5 4V2h2" />
          </svg>
        </TopBarBtn>

        <TopBarBtn title="Toggle theme" onClick={() => setSetting('dark', !dark)}>
          {dark ? (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2.6" />
              <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12.5 9.5A5 5 0 0 1 6.5 3.5a5 5 0 1 0 6 6z" />
            </svg>
          )}
        </TopBarBtn>

        <TopBarBtn title="Keyboard shortcuts (?)" onClick={onShortcuts}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1.5" y="4.5" width="13" height="8" rx="1.5" />
            <path d="M4.5 8h1M7.5 8h1M10.5 8h1M5.5 11h5" />
          </svg>
        </TopBarBtn>

        <TopBarBtn title="Settings (⌘,)" onClick={onSettings}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1.5 5h11M1.5 11h11" />
            <circle cx="5" cy="5" r="2" />
            <circle cx="9" cy="11" r="2" />
          </svg>
        </TopBarBtn>
      </div>
    </>
  )
}

function TopBarBtn({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 0,
        background: 'transparent',
        color: 'var(--ink-3)',
        width: 30,
        height: 30,
        borderRadius: 999,
        padding: 0,
        cursor: 'default',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
    >
      {children}
    </button>
  )
}

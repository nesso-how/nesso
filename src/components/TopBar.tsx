// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store/graph'
import { GraphIO } from './GraphIO'

interface Props {
  sidebarCollapsed: boolean
  sidebarWidth: number
  onExpandSidebar: () => void
  onRelationTypes: () => void
  onReview: () => void
}

export function TopBar({ sidebarCollapsed, sidebarWidth, onExpandSidebar, onRelationTypes, onReview }: Props) {
  const { graphList, currentGraphId, nodes, edges } = useGraphStore()
  const current = graphList.find(g => g.id === currentGraphId)

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: sidebarWidth,
      right: 0,
      height: 52,
      zIndex: 25,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px',
      borderBottom: '0.5px solid var(--line)',
      background: 'var(--paper)',
      transition: 'left 180ms ease',
    }}>
      {/* Left: expand sidebar (when collapsed) + graph title + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {sidebarCollapsed && (
          <button
            onClick={onExpandSidebar}
            title="Expand sidebar"
            type="button"
            style={expandSidebarBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M6 3v10" />
            </svg>
            <span style={{ font: "500 12px 'Inter', ui-sans-serif" }}>Sidebar</span>
          </button>
        )}
        <h1 style={{
          margin: 0,
          font: "500 16px 'Fraunces', ui-serif, Georgia, serif",
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}>
          {current?.name ?? '…'}
        </h1>
        <span style={{
          font: "500 10.5px 'JetBrains Mono', ui-monospace",
          color: 'var(--ink-4)',
          padding: '2px 7px',
          border: '0.5px solid var(--line)',
          borderRadius: 4,
        }}>
          {nodes.length} concepts · {edges.length} links
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LabelBtn onClick={onReview} title="Start review (R)">Review</LabelBtn>
        <LabelBtn onClick={onRelationTypes} title="Relation types">Relations</LabelBtn>
        <GraphIO />
      </div>
    </div>
  )
}

function LabelBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        appearance: 'none', border: '0.5px solid var(--line)',
        background: 'transparent', borderRadius: 6,
        padding: '5px 12px', cursor: 'default',
        font: "500 12px 'Inter', ui-sans-serif",
        color: 'var(--ink-3)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
    >
      {children}
    </button>
  )
}

const iconBtn: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent',
  width: 30, height: 30, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--ink-3)', cursor: 'default',
}

const expandSidebarBtn: React.CSSProperties = {
  ...iconBtn,
  width: 'auto',
  height: 30,
  padding: '0 10px',
  gap: 7,
}

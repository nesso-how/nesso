// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect } from 'react'
import { useGraphStore } from '@/store/graph'
import type { Node as FlowNode, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { useT } from '@/i18n'

interface Props {
  onRelationTypes: () => void
  onShortcuts: () => void
}

export function GraphIO({ onRelationTypes, onShortcuts }: Props) {
  const t = useT()
  const { nodes, edges, graphList, currentGraphId, importGraph } = useGraphStore()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof Element && wrapRef.current && !wrapRef.current.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleExport = () => {
    const meta = graphList.find(g => g.id === currentGraphId)
    const name = meta?.name ?? 'graph'
    const payload = JSON.stringify({ name, nodes, edges }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const data = JSON.parse(await file.text())
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return
        const name: string = data.name ?? file.name.replace(/\.json$/i, '')
        await importGraph(name, data.nodes as FlowNode<ConceptNodeData>[], data.edges as Edge[])
      } catch {}
    }
    input.click()
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        title={t.graphIO.moreOptions}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          appearance: 'none',
          border: '0.5px solid var(--line)',
          background: open ? 'var(--paper-deep)' : 'var(--bg-elev)',
          color: open ? 'var(--ink)' : 'var(--ink-2)',
          borderRadius: 999,
          padding: '6px 10px',
          cursor: 'default',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
        onMouseLeave={e => { e.currentTarget.style.background = open ? 'var(--paper-deep)' : 'var(--bg-elev)'; e.currentTarget.style.color = open ? 'var(--ink)' : 'var(--ink-2)' }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          minWidth: 220,
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 12,
          padding: 4,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 40,
        }}>
          <MenuItem
            onClick={() => { onRelationTypes(); setOpen(false) }}
            icon={
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4.5h10M2 8h10M2 11.5h7" />
              </svg>
            }
            label={t.graphIO.relationTypes}
          />
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 6px' }} />
          <MenuItem
            onClick={handleExport}
            icon={
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10V4M5 7l3-3 3 3" /><path d="M3 11v2h10v-2" />
              </svg>
            }
            label={t.graphIO.exportGraph}
          />
          <MenuItem
            onClick={handleImport}
            icon={
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 4v6M5 7l3 3 3-3" /><path d="M3 11v2h10v-2" />
              </svg>
            }
            label={t.graphIO.importGraph}
          />
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 6px' }} />
          <MenuItem
            onClick={() => { onShortcuts(); setOpen(false) }}
            icon={
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="4.5" width="13" height="8" rx="1.5" />
                <path d="M4.5 8h1M7.5 8h1M10.5 8h1M5.5 11h5" />
              </svg>
            }
            label={t.graphIO.keyboardShortcuts}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        border: 0,
        background: 'transparent',
        borderRadius: 8,
        cursor: 'default',
        textAlign: 'left',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{icon}</span>
      <span style={{ font: "500 13px 'Fraunces', ui-serif, Georgia, serif", color: 'var(--ink)', letterSpacing: '-0.005em' }}>{label}</span>
    </button>
  )
}

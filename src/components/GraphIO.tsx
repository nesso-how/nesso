// SPDX-License-Identifier: AGPL-3.0
import { useState, useRef, useEffect } from 'react'
import { useGraphStore } from '@/store/graph'
import type { Node as FlowNode, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

export function GraphIO() {
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
        title="Export / Import"
        onClick={() => setOpen(o => !o)}
        style={{
          appearance: 'none',
          border: 0,
          background: open ? 'var(--paper-deep)' : 'transparent',
          color: open ? 'var(--ink)' : 'var(--ink-3)',
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
        onMouseLeave={e => { e.currentTarget.style.background = open ? 'var(--paper-deep)' : 'transparent'; e.currentTarget.style.color = open ? 'var(--ink)' : 'var(--ink-3)' }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 6l3-3 3 3M11 10l-3 3-3-3" />
          <path d="M8 3v10" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          minWidth: 180,
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 12,
          padding: 4,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 40,
        }}>
          <MenuItem
            onClick={handleExport}
            icon={
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10V4M5 7l3-3 3 3" /><path d="M3 11v2h10v-2" />
              </svg>
            }
            label="Export graph"
            sub="Save as .json"
          />
          <MenuItem
            onClick={handleImport}
            icon={
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 4v6M5 7l3 3 3-3" /><path d="M3 11v2h10v-2" />
              </svg>
            }
            label="Import graph"
            sub="Open a .json file"
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, sub, onClick }: {
  icon: React.ReactNode
  label: string
  sub: string
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
      <div>
        <div style={{ font: "500 13px 'Fraunces', ui-serif, Georgia, serif", color: 'var(--ink)', letterSpacing: '-0.005em' }}>{label}</div>
        <div style={{ font: "500 10px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)', marginTop: 1 }}>{sub}</div>
      </div>
    </button>
  )
}

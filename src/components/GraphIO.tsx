// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect } from 'react'
import { useGraphStore } from '@/store/graph'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { useT } from '@/i18n'
import { exportShareGraphJson } from '@/lib/saveJsonFile'
import {
  deserializeGraph,
  nodesForGraphShareExport,
  nodesFromGraphShareImport,
  serializeGraph,
} from '@nesso-how/formats'

interface Props {
  onRelationTypes: () => void
  onShortcuts: () => void
}

export function GraphIO({ onRelationTypes, onShortcuts }: Props) {
  const t = useT()
  const { nodes, edges, graphList, currentGraphId, graphDisplay, importGraph } = useGraphStore()
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

  const handleExport = async () => {
    setOpen(false)
    const meta = graphList.find(g => g.id === currentGraphId)
    const name = meta?.name ?? 'graph'
    const filename = `${name}.json`
    const payload = serializeGraph({
      name,
      nodes: nodesForGraphShareExport(nodes),
      edges,
      display: graphDisplay,
    })
    await exportShareGraphJson(
      filename,
      payload,
      fn => window.confirm(t.graphIO.exportOverwriteConfirm.replace('{name}', fn)),
    )
  }

  const handleExportPng = async () => {
    setOpen(false)
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewport || nodes.length === 0) return
    const meta = graphList.find(g => g.id === currentGraphId)
    const name = meta?.name ?? 'graph'

    const padding = 64
    const imageWidth = 1920
    const imageHeight = 1200
    const bounds = getNodesBounds(nodes)
    const fitted = getViewportForBounds(bounds, imageWidth - padding * 2, imageHeight - padding * 2, 0.15, 2.5, 0)
    const tx = fitted.x + padding
    const ty = fitted.y + padding
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#ffffff'

    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: bg,
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${tx}px, ${ty}px) scale(${fitted.zoom})`,
        },
        filter: (el) => {
          // React Flow draws handles/selection chrome that don't belong in an export.
          if (!(el instanceof Element)) return true
          if (el.classList.contains('react-flow__handle')) return false
          if (el.classList.contains('react-flow__edge-handle')) return false
          return true
        },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${name}.png`
      a.click()
    } catch {}
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const data = deserializeGraph(await file.text())
        const name = data.name?.trim() || file.name.replace(/\.json$/i, '')
        await importGraph(
          name,
          nodesFromGraphShareImport(data.nodes),
          data.edges,
          data.display,
          data.id,
        )
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
            onClick={handleExportPng}
            icon={
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="10" rx="1.5" />
                <circle cx="5.5" cy="6.5" r="1" />
                <path d="M2.5 12l3-3 2.5 2.5L11 8.5l2.5 2.5" />
              </svg>
            }
            label={t.graphIO.exportPng}
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
      <span style={{ font: "500 13px 'Inter', system-ui", color: 'var(--ink)' }}>{label}</span>
    </button>
  )
}

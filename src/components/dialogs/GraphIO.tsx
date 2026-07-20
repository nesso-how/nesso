// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect } from 'react'
import { useT } from '@/i18n'
import { exportGraphJson, exportGraphPng, importGraphFile } from '@/lib/graphIO'
import { toast } from '@/components/ui/toast'

/** Surface an export error through the toast system with a locale-aware fallback. */
function toastExportError(err: unknown, fallback: () => string): void {
  const msg = err instanceof Error ? err.message : String(err)
  toast.error(msg || fallback())
}

interface Props {
  onRelationTypes: () => void
  onShortcuts: () => void
  onAbout: () => void
}

export function GraphIO({ onRelationTypes, onShortcuts, onAbout }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof Element && wrapRef.current && !wrapRef.current.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleExport = async () => {
    setOpen(false)
    try {
      await exportGraphJson()
    } catch (err) {
      // exportGraphJson already emits telemetry with the failure reason.
      // Surface the native error through the toast system.
      toastExportError(
        err,
        () => t.graphIO.importError.split('.').slice(0, -1).join('.') || 'Export failed',
      )
    }
  }

  const handleExportPng = async () => {
    setOpen(false)
    try {
      await exportGraphPng()
    } catch (err) {
      // exportGraphPng already emits failure telemetry internally.
      toastExportError(err, () => t.graphIO.importError || 'Export failed')
    }
  }

  const handleImport = () => {
    setOpen(false)
    importGraphFile()
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid="graph-io-menu"
        title={t.graphIO.moreOptions}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          appearance: 'none',
          border: '0.5px solid var(--line)',
          background: open ? 'var(--paper-deep)' : 'var(--bg-card)',
          color: open ? 'var(--ink)' : 'var(--ink-2)',
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-md)',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--paper-deep)'
          e.currentTarget.style.color = 'var(--ink)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = open ? 'var(--paper-deep)' : 'var(--bg-card)'
          e.currentTarget.style.color = open ? 'var(--ink)' : 'var(--ink-2)'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 220,
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-2)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 40,
          }}
        >
          <MenuItem
            onClick={() => {
              onRelationTypes()
              setOpen(false)
            }}
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M2 4.5h10M2 8h10M2 11.5h7" />
              </svg>
            }
            label={t.graphIO.relationTypes}
          />
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 6px' }} />
          <MenuItem
            onClick={handleExport}
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 10V4M5 7l3-3 3 3" />
                <path d="M3 11v2h10v-2" />
              </svg>
            }
            label={t.graphIO.exportGraph}
          />
          <MenuItem
            onClick={handleExportPng}
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 4v6M5 7l3 3 3-3" />
                <path d="M3 11v2h10v-2" />
              </svg>
            }
            label={t.graphIO.importGraph}
          />
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 6px' }} />
          <MenuItem
            onClick={() => {
              onShortcuts()
              setOpen(false)
            }}
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="1.5" y="4.5" width="13" height="8" rx="1.5" />
                <path d="M4.5 8h1M7.5 8h1M10.5 8h1M5.5 11h5" />
              </svg>
            }
            label={t.graphIO.keyboardShortcuts}
          />
          <MenuItem
            onClick={() => {
              onAbout()
              setOpen(false)
            }}
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.25v3.25" />
                <circle cx="8" cy="5.2" r="0.1" />
              </svg>
            }
            label={t.graphIO.about}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
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
        gap: 'var(--space-5)',
        width: '100%',
        padding: '8px 10px',
        border: 0,
        background: 'transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--paper-deep)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink)',
        }}
      >
        {label}
      </span>
    </button>
  )
}

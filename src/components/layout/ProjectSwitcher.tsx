// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { getDefaultWorkspacePath, normalizePath, projectDisplayName } from '@/lib/workspace'
import { FolderIcon, CloseIcon } from '@/components/ui/icons'

export function ProjectSwitcher() {
  const t = useT()
  const knownProjects = useGraphStore((s) => s.settings.knownProjects)
  const activeProjectPath = useGraphStore((s) => s.settings.activeProjectPath)
  const createProject = useGraphStore((s) => s.createProject)
  const openProject = useGraphStore((s) => s.openProject)
  const switchProject = useGraphStore((s) => s.switchProject)
  const removeProject = useGraphStore((s) => s.removeProject)

  const [open, setOpen] = useState(false)
  const [defaultPath, setDefaultPath] = useState<string | null>(null)
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    void getDefaultWorkspacePath().then((p) => setDefaultPath(normalizePath(p)))
  }, [])

  const defaultName = t.sidebar.projectSwitcher.defaultProjectName
  const activeNorm = activeProjectPath ? normalizePath(activeProjectPath) : null
  const activeName = activeProjectPath
    ? projectDisplayName(activeProjectPath, defaultPath, defaultName)
    : ''

  const rect = btnRef.current?.getBoundingClientRect()
  const left = rect?.left ?? 0
  const top = rect ? rect.bottom + 6 : 0

  const removable = knownProjects.length > 1

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={activeProjectPath ?? undefined}
        style={{ ...switcherBtn, background: open ? 'var(--paper-deep)' : 'transparent' }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = 'var(--paper-deep)'
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'transparent'
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeName || t.sidebar.projectSwitcher.noProject}
        </span>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            lineHeight: 0,
            color: 'var(--ink-4)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 140ms',
          }}
        >
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left,
              top,
              width: 248,
              background: 'var(--bg-card)',
              border: '0.5px solid var(--line-strong)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-lg)',
              padding: 5,
            }}
          >
            <div style={menuLabel}>{t.sidebar.projectSwitcher.projects}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {knownProjects.map((path) => {
                const norm = normalizePath(path)
                const isActive = norm === activeNorm
                const hovered = hoveredPath === path

                return (
                  <div
                    key={path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 8,
                      background: isActive || hovered ? 'var(--paper-deep)' : 'transparent',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={() => setHoveredPath(path)}
                    onMouseLeave={() => setHoveredPath(null)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        if (!isActive) void switchProject(path)
                      }}
                      style={{
                        ...projectRow,
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: isActive ? 'var(--accent)' : 'var(--ink-5)',
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                        }}
                      >
                        {projectDisplayName(path, defaultPath, defaultName)}
                      </span>
                    </button>

                    {hovered && (
                      <>
                        <button
                          type="button"
                          title={t.sidebar.projectSwitcher.revealInFinder}
                          onClick={(e) => {
                            e.stopPropagation()
                            void (async () => {
                              // revealItemInDir only highlights in the file manager —
                              // unlike openPath it can never launch an arbitrary app.
                              const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
                              await revealItemInDir(path).catch(() => {})
                            })()
                          }}
                          style={rowIconBtn}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--ink-2)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--ink-4)'
                          }}
                        >
                          <FolderIcon />
                        </button>
                        {removable && (
                          <button
                            type="button"
                            title={t.sidebar.projectSwitcher.removeProject}
                            onClick={(e) => {
                              e.stopPropagation()
                              void removeProject(path)
                            }}
                            style={{ ...rowIconBtn, marginRight: 4 }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--ink-2)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--ink-4)'
                            }}
                          >
                            <CloseIcon />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={separator} />

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void createProject()
              }}
              style={actionRow}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--paper-deep)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={actionIcon} aria-hidden>
                <PlusIcon />
              </span>
              {t.sidebar.projectSwitcher.newProject}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void openProject()
              }}
              style={actionRow}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--paper-deep)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={actionIcon} aria-hidden>
                <FolderIcon />
              </span>
              {t.sidebar.projectSwitcher.openProject}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ChevronIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 6.5 8 10l3.5-3.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

const switcherBtn: React.CSSProperties = {
  appearance: 'none',
  border: '0.5px solid transparent',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  maxWidth: 168,
  height: 28,
  padding: '0 9px',
  borderRadius: 7,
  font: "500 13px 'Inter', ui-sans-serif",
  color: 'var(--ink)',
  cursor: 'default',
  transition: 'background 120ms',
}

const menuLabel: React.CSSProperties = {
  font: "500 10.5px 'JetBrains Mono', ui-monospace",
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '8px 11px 6px',
}

const projectRow: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 11px',
  borderRadius: 8,
  cursor: 'default',
  textAlign: 'left',
  font: "500 13px 'Inter', ui-sans-serif",
  background: 'transparent',
}

const separator: React.CSSProperties = {
  height: 0.5,
  background: 'var(--line)',
  margin: '5px 9px',
}

const actionRow: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  padding: '8px 11px',
  borderRadius: 8,
  cursor: 'default',
  textAlign: 'left',
  font: "500 12.5px 'Inter', ui-sans-serif",
  color: 'var(--ink-2)',
  transition: 'background 100ms',
}

const actionIcon: React.CSSProperties = {
  width: 16,
  height: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-4)',
  flexShrink: 0,
}

const rowIconBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  width: 26,
  height: 26,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  color: 'var(--ink-4)',
  cursor: 'default',
  transition: 'color 0.12s',
}

// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { getDefaultWorkspacePath, normalizePath, projectDisplayName } from '@/lib/workspace'
import { FolderIcon } from '@/components/ui/icons'
import { confirm } from '@/components/ui/confirm'

const sectionLabel: React.CSSProperties = {
  font: "500 11px 'JetBrains Mono', ui-monospace",
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const rowIconBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  width: 22,
  height: 22,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  color: 'var(--ink-4)',
  cursor: 'default',
}

/** Desktop-only Projects section: switch / reveal / remove folders, new + open.
 *  Replaces the header ProjectSwitcher dropdown in the redesigned sidebar. */
export function SidebarProjects() {
  const t = useT()
  const knownProjects = useGraphStore((s) => s.settings.knownProjects)
  const missingProjects = useGraphStore((s) => s.missingProjects)
  const activeProjectPath = useGraphStore((s) => s.settings.activeProjectPath)
  const createProject = useGraphStore((s) => s.createProject)
  const openProject = useGraphStore((s) => s.openProject)
  const switchProject = useGraphStore((s) => s.switchProject)
  const removeProject = useGraphStore((s) => s.removeProject)

  const [open, setOpen] = useState(true)
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [defaultPath, setDefaultPath] = useState<string | null>(null)

  useEffect(() => {
    void getDefaultWorkspacePath().then((p) => setDefaultPath(normalizePath(p)))
  }, [])

  const defaultName = t.sidebar.projectSwitcher.defaultProjectName
  const activeNorm = activeProjectPath ? normalizePath(activeProjectPath) : null
  const removable = knownProjects.length > 1

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          padding: '10px 12px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            appearance: 'none',
            border: 0,
            background: 'transparent',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 0,
          }}
        >
          <span
            style={{
              color: 'var(--ink-4)',
              display: 'flex',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 150ms',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 4l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span style={sectionLabel}>{t.sidebar.projectSwitcher.projects}</span>
        </button>
        <button
          type="button"
          title={t.sidebar.projectSwitcher.newProject}
          onClick={() => void createProject()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            appearance: 'none',
            border: 0,
            background: 'transparent',
            cursor: 'default',
            color: 'var(--ink-4)',
            font: "500 11px 'Inter', ui-sans-serif",
            padding: '2px 5px',
            borderRadius: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ink-2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink-4)'
          }}
        >
          <svg width="11" height="11" viewBox="0 0 10 10">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {t.sidebar.newGraph}
        </button>
      </div>

      {open && (
        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {knownProjects.map((path) => {
            const norm = normalizePath(path)
            const isActive = norm === activeNorm
            const isMissing = missingProjects.includes(norm)
            const hovered = hoveredPath === path
            return (
              <div
                key={path}
                onMouseEnter={() => setHoveredPath(path)}
                onMouseLeave={() => setHoveredPath(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 6,
                  background: isActive || hovered ? 'var(--paper-deep)' : 'transparent',
                  transition: 'background 100ms',
                }}
              >
                <button
                  type="button"
                  title={isMissing ? t.sidebar.projectSwitcher.missingProjectHint : path}
                  onClick={() => {
                    if (!isActive) void switchProject(path)
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    appearance: 'none',
                    border: 0,
                    background: 'transparent',
                    borderRadius: 6,
                    padding: '6px 9px',
                    cursor: 'default',
                    textAlign: 'left',
                    opacity: isMissing ? 0.55 : 1,
                    font: isActive
                      ? "500 13px 'Inter', ui-sans-serif"
                      : "13px 'Inter', ui-sans-serif",
                    color: isActive ? 'var(--ink)' : 'var(--ink-2)',
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
                    }}
                  >
                    {projectDisplayName(path, defaultPath, defaultName)}
                  </span>
                  {isMissing && (
                    <span
                      style={{
                        flexShrink: 0,
                        font: "500 10.5px 'JetBrains Mono', ui-monospace",
                        fontStyle: 'italic',
                        color: 'var(--ink-4)',
                      }}
                    >
                      {t.sidebar.projectSwitcher.missingProject}
                    </span>
                  )}
                </button>
                {hovered && (
                  <div style={{ display: 'flex', gap: 1, marginRight: 4 }}>
                    {!isMissing && (
                      <button
                        type="button"
                        title={t.sidebar.projectSwitcher.revealInFinder}
                        onClick={(e) => {
                          e.stopPropagation()
                          void (async () => {
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
                    )}
                    {removable && (
                      <button
                        type="button"
                        title={t.sidebar.projectSwitcher.removeProject}
                        onClick={(e) => {
                          e.stopPropagation()
                          void (async () => {
                            const confirmed = await confirm({
                              title: t.sidebar.projectSwitcher.removeProject,
                              message: t.sidebar.projectSwitcher.removeProjectConfirm.replace(
                                '{name}',
                                projectDisplayName(path, defaultPath, defaultName),
                              ),
                              confirmLabel: t.sidebar.projectSwitcher.removeProjectCta,
                              cancelLabel: t.common.cancel,
                              tone: 'danger',
                            })
                            if (confirmed) await removeProject(path)
                          })()
                        }}
                        style={rowIconBtn}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--cat-opposition)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--ink-4)'
                        }}
                      >
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
                          <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.6 8a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.6-8" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => void openProject()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              appearance: 'none',
              border: 0,
              background: 'transparent',
              borderRadius: 6,
              padding: '6px 9px',
              cursor: 'default',
              textAlign: 'left',
              font: "13px 'Inter', ui-sans-serif",
              color: 'var(--ink-4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--paper-deep)'
              e.currentTarget.style.color = 'var(--ink-2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--ink-4)'
            }}
          >
            <span style={{ width: 6, flexShrink: 0 }} aria-hidden />
            {t.sidebar.projectSwitcher.openProject}
          </button>
        </div>
      )}
    </div>
  )
}

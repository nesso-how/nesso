// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { getDefaultWorkspacePath, normalizePath, projectDisplayName } from '@/lib/workspace'
import { FolderIcon, Icon } from '@/components/ui/icons'
import { hoverStyle } from '@/lib/hoverStyle'
import { confirm } from '@/components/ui/confirm'

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  fontFamily: 'var(--font-mono)',
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const rowIconBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  width: 26,
  height: 26,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--ink-4)',
  cursor: 'pointer',
}

/** Mirrors the Graphs section "New" button (Sidebar.tsx `graphsNewBtn`). */
const newBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  height: 24,
  borderRadius: 'var(--radius-sm)',
  padding: '0 7px 0 6px',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  color: 'var(--ink-3)',
  cursor: 'pointer',
}

/** Desktop-only Projects section: switch / reveal / remove folders; the
 *  "+" button opens the native folder picker directly. Collapsed, it keeps
 *  only the current project visible. */
export function SidebarProjects() {
  const t = useT()
  const knownProjects = useGraphStore((s) => s.settings.knownProjects)
  const missingProjects = useGraphStore((s) => s.missingProjects)
  const activeProjectPath = useGraphStore((s) => s.settings.activeProjectPath)
  const openOrCreateProject = useGraphStore((s) => s.openOrCreateProject)
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
  // Collapsed: keep only the current project visible, not an empty section.
  const visibleProjects = open
    ? knownProjects
    : knownProjects.filter((p) => normalizePath(p) === activeNorm)

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
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
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
          title={t.sidebar.projectSwitcher.openOrCreateProject}
          onClick={() => void openOrCreateProject()}
          style={{ ...newBtn, color: 'var(--ink-3)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ink)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink-3)'
          }}
        >
          <svg width="11" height="11" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '11.5px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
            {t.sidebar.projectSwitcher.openOrCreateProjectShort}
          </span>
        </button>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {visibleProjects.map((path) => {
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
                borderRadius: 'var(--radius-sm)',
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
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 9px',
                  cursor: 'pointer',
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
                    borderRadius: 'var(--radius-pill)',
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
                      fontSize: '10.5px',
                      fontWeight: 500,
                      fontFamily: 'var(--font-mono)',
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
                      {...hoverStyle({ color: 'var(--cat-opposition)' }, { color: 'var(--ink-4)' })}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

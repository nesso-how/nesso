// SPDX-License-Identifier: MIT
import { useHorizontalResize } from '@/hooks/useHorizontalResize'
import { SidebarProjects } from './SidebarProjects'
import { SidebarHeader } from './sidebar/SidebarHeader'
import { SidebarSearchButton } from './sidebar/SidebarSearchButton'
import { SidebarGraphsSection } from './sidebar/SidebarGraphsSection'
import { SidebarDisplaySection } from './sidebar/SidebarDisplaySection'
import { SidebarFooter } from './sidebar/SidebarFooter'
import { isDesktop } from '@/lib/isDesktop'
import { SIDEBAR_WIDTH_STORAGE_KEY } from '@/data/storageKeys'
import { createPanelWidthStorage } from '@/lib/panelWidth'
import { ResizeHandle } from '@/components/ui/ResizeHandle'

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 380
export const SIDEBAR_DEFAULT_WIDTH = 248

const sidebarWidthStorage = createPanelWidthStorage({
  storageKey: SIDEBAR_WIDTH_STORAGE_KEY,
  min: SIDEBAR_MIN_WIDTH,
  max: SIDEBAR_MAX_WIDTH,
  fallback: SIDEBAR_DEFAULT_WIDTH,
})

export const clampSidebarWidth = sidebarWidthStorage.clampWidth
export const readSidebarWidth = sidebarWidthStorage.readWidth
export const writeSidebarWidth = sidebarWidthStorage.writeWidth

interface Props {
  collapsed: boolean
  onCollapse: () => void
  onSearch: () => void
  onSettings: () => void
  width: number
  onWidthChange: (w: number) => void
}

export function Sidebar({
  collapsed,
  onCollapse,
  onSearch,
  onSettings,
  width,
  onWidthChange,
}: Props) {
  const { isResizing, onResizeHandleMouseDown, onResizeHandleKeyDown } = useHorizontalResize(
    width,
    onWidthChange,
    clampSidebarWidth,
  )

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: collapsed ? 0 : width,
        zIndex: 30,
        transition: isResizing ? 'none' : 'width 180ms ease',
      }}
    >
      <div
        style={{
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          background: 'var(--bg-elev)',
          borderRight: '0.5px solid var(--line)',
          borderTop: isDesktop() ? '0.5px solid var(--line)' : undefined,
        }}
      >
        <div style={{ width, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <SidebarHeader onCollapse={onCollapse} />

          <SidebarSearchButton onSearch={onSearch} />

          {/* Scrollable body — block flow so sections stack naturally without flex pushing */}
          <div className="nesso-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {/* Projects (desktop only) */}
            {isDesktop() && (
              <>
                <SidebarProjects />
                <div style={{ height: '0.5px', background: 'var(--line)', margin: '6px 12px' }} />
              </>
            )}

            {/* Graphs */}
            <SidebarGraphsSection />
          </div>

          {/* Display section — fixed above footer, outside scroll */}
          <SidebarDisplaySection />

          {/* Footer — Settings */}
          <SidebarFooter onSettings={onSettings} />
        </div>
      </div>

      {/* Resize handle — outside overflow:hidden wrapper so it can straddle the border */}
      {!collapsed && (
        <ResizeHandle
          side="right"
          ariaLabel="Resize sidebar"
          onMouseDown={onResizeHandleMouseDown}
          onKeyDown={onResizeHandleKeyDown}
        />
      )}
    </div>
  )
}

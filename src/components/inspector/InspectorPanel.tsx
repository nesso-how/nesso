// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react'
import { TOPBAR_HEIGHT_PX } from '@/components/layout/TopBar'
import { STATUS_BAR_HEIGHT_PX } from '@/components/layout/StatusBar'
import { useT } from '@/i18n'
import { useHorizontalResize } from '@/hooks/useHorizontalResize'
import {
  clampInspectorPanelWidth,
  INSPECTOR_PANEL_MAX_WIDTH,
  INSPECTOR_PANEL_MIN_WIDTH,
} from './layout'

interface Props {
  panelWidth: number
  onPanelWidthChange: (w: number) => void
  children: ReactNode
}

/** Right-docked, full-height detail shell. Flush to the right edge, between the
 *  top bar and the status bar; the resize handle lives on its LEFT border. */
export function InspectorPanel({ panelWidth, onPanelWidthChange, children }: Props) {
  const t = useT()
  // Right-docked: dragging the left handle LEFT widens the panel — invert.
  const { onResizeHandleMouseDown, onResizeHandleKeyDown } = useHorizontalResize(
    panelWidth,
    onPanelWidthChange,
    clampInspectorPanelWidth,
    true,
  )

  return (
    <div
      data-chrome
      style={{
        position: 'absolute',
        top: TOPBAR_HEIGHT_PX,
        right: 0,
        bottom: STATUS_BAR_HEIGHT_PX,
        width: panelWidth,
        zIndex: 25,
        background: 'var(--bg-card)',
        borderLeft: '0.5px solid var(--line)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {children}

      <button
        type="button"
        aria-valuenow={Math.round(panelWidth)}
        aria-valuemin={INSPECTOR_PANEL_MIN_WIDTH}
        aria-valuemax={INSPECTOR_PANEL_MAX_WIDTH}
        aria-label={`Resize inspector width (${panelWidth}px). Arrow keys adjust width.`}
        title={t.inspector.resizeHandle}
        onMouseDown={onResizeHandleMouseDown}
        onKeyDown={onResizeHandleKeyDown}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -4,
          width: 8,
          cursor: 'col-resize',
          touchAction: 'none',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

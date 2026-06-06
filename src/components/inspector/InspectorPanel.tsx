// SPDX-License-Identifier: MIT
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { TOPBAR_HEIGHT_PX } from '@/components/TopBar'
import { useT } from '@/i18n'
import {
  clampInspectorPanelWidth,
  INSPECTOR_PANEL_EDGE_INSET,
  INSPECTOR_PANEL_MAX_WIDTH,
  INSPECTOR_PANEL_MIN_WIDTH,
  INSPECTOR_VIEWPORT_BOTTOM_RESERVE,
} from './layout'

interface Props {
  leftOffset: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
  children: ReactNode
  noPadding?: boolean
}

export function InspectorPanel({
  leftOffset,
  panelWidth,
  onPanelWidthChange,
  children,
  noPadding = false,
}: Props) {
  const t = useT()

  function startResize(mouseDownClientX: number) {
    const startX = mouseDownClientX
    const startW = panelWidth
    function onMove(ev: MouseEvent) {
      onPanelWidthChange(clampInspectorPanelWidth(startW + ev.clientX - startX))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function onResizeEdgeMouseDown(e: ReactMouseEvent) {
    e.preventDefault()
    startResize(e.clientX)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: leftOffset + INSPECTOR_PANEL_EDGE_INSET,
        top: TOPBAR_HEIGHT_PX + INSPECTOR_PANEL_EDGE_INSET,
        width: panelWidth,
        zIndex: 25,
        background: 'var(--bg-elev)',
        border: '0.5px solid var(--line)',
        borderRadius: 14,
        padding: noPadding ? 0 : '16px 16px 10px',
        paddingRight: noPadding ? 0 : 20,
        boxShadow: 'var(--shadow-md)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: noPadding ? 'hidden' : 'visible',
        maxHeight: `calc(100vh - ${TOPBAR_HEIGHT_PX + INSPECTOR_PANEL_EDGE_INSET}px - ${INSPECTOR_VIEWPORT_BOTTOM_RESERVE}px)`,
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
        onMouseDown={onResizeEdgeMouseDown}
        onKeyDown={(e) => {
          const step = 12
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onPanelWidthChange(clampInspectorPanelWidth(panelWidth - step))
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            onPanelWidthChange(clampInspectorPanelWidth(panelWidth + step))
          }
        }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: -4,
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

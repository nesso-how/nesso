// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useGraphStore, graphDisplaySelector } from '@/store'
import { useT, getT } from '@/i18n'
import { isDesktop } from '@/lib/isDesktop'
import { applyDesktopMenu } from '@/lib/desktopMenu'
import { exportGraphJson, exportGraphPng, importGraphFile } from '@/lib/graphIO'
import { openExternal, DOCS_URL, WEBSITE_URL, FEEDBACK_URL } from '@/data/appInfo'
import { toast } from '@/components/ui/toast'
import { track } from '@/telemetry'

interface DesktopMenuHandlers {
  onSettings: () => void
  onShortcuts: () => void
  onAbout: () => void
  onFit: () => void
}

/**
 * Drives the native desktop menu: routes `menu:*` events to store actions,
 * dialogs and the canvas, and rebuilds the menu (labels + check state) whenever
 * the language or graph-display settings change. Inert on the web build.
 */
export function useDesktopMenu(handlers: DesktopMenuHandlers): void {
  const menuLabels = useT().menu
  const display = useGraphStore(graphDisplaySelector)
  const { zoomIn, zoomOut } = useReactFlow()

  // Listeners are registered once; a ref keeps them calling the latest handlers
  // without tearing down and re-adding on every render.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!isDesktop()) return
    const unlistens: (() => void)[] = []
    let cancelled = false

    void (async () => {
      const { listen } = await import('@tauri-apps/api/event')
      if (cancelled) return
      const store = () => useGraphStore.getState()
      const on = async (id: string, run: () => void) => {
        unlistens.push(await listen(`menu:${id}`, run))
      }

      await on('about', () => handlersRef.current.onAbout())
      await on('settings', () => handlersRef.current.onSettings())
      await on('shortcuts', () => handlersRef.current.onShortcuts())
      await on('fit', () => handlersRef.current.onFit())
      await on('zoom-in', () => void zoomIn())
      await on('zoom-out', () => void zoomOut())

      await on('new-graph', async () => {
        try {
          await store().createGraph(getT().sidebar.untitled)
          track({ name: 'graph_created', props: { source: 'desktop_menu' } })
        } catch {
          // creation failed — no telemetry emitted
        }
      })
      await on('open-project', () => void store().openOrCreateProject())
      await on('export-json', async () => {
        try {
          await exportGraphJson()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          toast.error(msg || 'Export failed')
        }
      })
      await on('export-png', async () => {
        try {
          await exportGraphPng()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          toast.error(msg || 'Export failed')
        }
      })
      await on('import', () => importGraphFile())

      await on('heatmap', () =>
        store().setGraphDisplay('showHeatmap', !store().graphDisplay.showHeatmap),
      )
      await on('edges-full', () => store().setGraphDisplay('edgeEncoding', 'full'))
      await on('edges-category', () => store().setGraphDisplay('edgeEncoding', 'category'))
      await on('edges-minimal', () => store().setGraphDisplay('edgeEncoding', 'minimal'))
      await on('curve-arc', () => store().setGraphDisplay('curveStyle', 'arc'))
      await on('curve-straight', () => store().setGraphDisplay('curveStyle', 'straight'))

      await on('docs', () => void openExternal(DOCS_URL))
      await on('website', () => void openExternal(WEBSITE_URL))
      await on('report-issue', () => void openExternal(FEEDBACK_URL))

      if (cancelled) unlistens.forEach((u) => u())
    })()

    return () => {
      cancelled = true
      unlistens.forEach((u) => u())
    }
  }, [zoomIn, zoomOut])

  // Rebuild on mount and whenever labels (language) or display state change so
  // the menu text and View check marks stay in sync with the app.
  useEffect(() => {
    void applyDesktopMenu(menuLabels, display)
  }, [menuLabels, display])
}

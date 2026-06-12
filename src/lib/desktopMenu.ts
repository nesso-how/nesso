// SPDX-License-Identifier: MIT
import type { Locale } from '@/i18n'
import type { GraphDisplaySettings } from '@/types/graph'
import { isDesktop } from '@/lib/isDesktop'

/**
 * Rebuilds the native menu with localized labels and the current display state.
 * The `menu` locale keys map 1:1 to the Rust `MenuLabels` fields, so they are
 * passed straight through. No-op on the web build.
 */
export async function applyDesktopMenu(
  menu: Locale['menu'],
  display: GraphDisplaySettings,
): Promise<void> {
  if (!isDesktop()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_app_menu', {
    labels: menu,
    state: {
      heatmap: display.showHeatmap,
      edgeEncoding: display.edgeEncoding,
      curveStyle: display.curveStyle,
    },
  }).catch(() => {})
}

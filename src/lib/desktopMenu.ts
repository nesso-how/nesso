// SPDX-License-Identifier: MIT
import type { Locale } from '@/i18n'
import type { GraphDisplaySettings } from '@/types/graph'
import { isDesktop } from '@/lib/isDesktop'

/**
 * Rebuilds the native menu with localized labels and the current display state.
 * The `menu` locale keys map 1:1 to the Rust `MenuItemId` entries, so they are
 * passed straight through as `[id, label]` pairs. No-op on the web build.
 */
export async function applyDesktopMenu(
  menu: Locale['menu'],
  display: GraphDisplaySettings,
): Promise<void> {
  if (!isDesktop()) return
  const { invoke } = await import('@tauri-apps/api/core')
  // Log invoke failures instead of swallowing them: unknown frontend menu
  // keys fail the whole deserialization by design (strict `MenuItemId`
  // enum), and a silent catch would hide that wiring mistake.
  await invoke('set_app_menu', {
    labels: Object.entries(menu),
    state: {
      heatmap: display.showHeatmap,
      edgeEncoding: display.edgeEncoding,
      curveStyle: display.curveStyle,
    },
  }).catch((err) => {
    console.error('[nesso] set_app_menu failed:', err)
  })
}

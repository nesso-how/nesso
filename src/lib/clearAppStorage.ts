// SPDX-License-Identifier: MIT
import {
  INSPECTOR_WIDTH_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
  ZUSTAND_PERSIST_KEY,
} from '@/data/storageKeys'
import { wipeGraphsIndexedDb } from '@/store/db'

/** Removes persisted graphs, Zustand blob, and panel width prefs, then reloads the window. */
export async function clearPersistedAppDataAndReload(): Promise<void> {
  await wipeGraphsIndexedDb()
  try {
    localStorage.removeItem(ZUSTAND_PERSIST_KEY)
    localStorage.removeItem(INSPECTOR_WIDTH_STORAGE_KEY)
    localStorage.removeItem(SIDEBAR_WIDTH_STORAGE_KEY)
  } catch {
    /* private mode / quota */
  }
  window.location.reload()
}

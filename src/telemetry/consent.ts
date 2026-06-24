// SPDX-License-Identifier: MIT
import { ZUSTAND_PERSIST_KEY } from '@/data/storageKeys'

/** Read persisted opt-in without importing the store (safe at boot). */
export function readTelemetryConsent(): boolean {
  try {
    const raw = localStorage.getItem(ZUSTAND_PERSIST_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { state?: { settings?: { telemetry?: boolean } } }
    return parsed.state?.settings?.telemetry === true
  } catch {
    return false
  }
}

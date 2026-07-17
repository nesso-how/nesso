// SPDX-License-Identifier: MIT
import { isLocalhostUrl } from '@/llm/completion'

const LOOPBACK_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/

export type ErrorHint = 'ollama-not-running' | 'cors-blocked' | 'unreachable'

/**
 * Classifies an `'error'` status into a display hint based on the endpoint URL,
 * platform, and the app's own hostname. Pure — no rendering, no store, no fetch.
 */
export function getErrorHint(baseUrl: string, isDesktop: boolean, appHostname: string): ErrorHint {
  if (!isLocalhostUrl(baseUrl)) return 'unreachable'
  // Desktop: native HTTP transport — never a browser CORS issue.
  if (isDesktop) return 'ollama-not-running'
  // Browser: check whether the app is served from the same loopback host.
  try {
    const hostname = new URL(baseUrl).hostname
    if (LOOPBACK_HOST_RE.test(hostname) && LOOPBACK_HOST_RE.test(appHostname)) {
      return 'ollama-not-running'
    }
  } catch {
    // Unparseable URL — default to CORS hint (local URL we can't parse).
  }
  return 'cors-blocked'
}

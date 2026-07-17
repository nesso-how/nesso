// SPDX-License-Identifier: MIT

export type OllamaModelStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'pulling'
  | 'unauthorized'
  | 'error'

/** Re-export from the single AI networking boundary. */
export { isLocalhostUrl, ollamaNativeBase } from '@/llm/completion'

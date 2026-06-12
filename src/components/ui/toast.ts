// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import type { ToastVariant } from '@/store/types'

let counter = 0

function show(variant: ToastVariant, message: string): void {
  counter += 1
  useGraphStore.getState().pushToast({ id: `toast-${counter}`, variant, message })
}

/**
 * Imperative, non-blocking notifications callable from both components and the
 * store. Rendered by `<ToastViewport>`, mounted once at the app shell.
 */
export const toast = {
  info: (message: string): void => show('info', message),
  error: (message: string): void => show('error', message),
}

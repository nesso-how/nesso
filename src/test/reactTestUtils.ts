// SPDX-License-Identifier: MIT
import { createRoot, type Root } from 'react-dom/client'

export function createReactTestRoot(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return { container, root: createRoot(container) }
}

// SPDX-License-Identifier: MIT
/** Move keyboard focus to a React Flow node wrapper so arrow-key nudge works. */
export function focusFlowNodes(nodeIds: string[]): void {
  const id = nodeIds[0]
  if (!id) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `.react-flow__node[data-id="${CSS.escape(id)}"]`,
      ) as HTMLElement | null
      el?.focus({ preventScroll: true })
    })
  })
}

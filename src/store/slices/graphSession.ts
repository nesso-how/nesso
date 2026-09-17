// SPDX-License-Identifier: MIT
import type { GraphMeta } from '../types'

// Guards the clear+reload window during project switches:
// _switchingProject blocks saveCurrentGraph from writing to the wrong folder;
// _switchProjectInflight serialises concurrent switchProject invocations.
let _switchingProject = false
let _switchProjectInflight: Promise<GraphMeta[]> | null = null
// Set while abandoning a project whose folder was deleted externally — any
// save in that window would silently recreate the folder from the IDB cache.
let _suppressOutgoingSave = false
// Monotonic counter for loadGraph race prevention — the most recently started
// call wins, older ones are discarded. Has no semantic meaning beyond this.
let _loadRequestId = 0
// React Flow drag markers (not store state): a node id is present while its
// drag gesture is in progress, so onNodesChange pushes history once per
// gesture. Entries are removed on drag end and the whole set is cleared on
// undo/redo and every path that replaces the active graph in memory
// (load, create, import, reload-from-disk).
const _draggingNodeIds = new Set<string>()

/** True while a project switch holds the clear+reload window. */
export function isSwitchingProject(): boolean {
  return _switchingProject
}

/** Enter the switch window; must precede any store update the switch makes. */
export function beginSwitchProject(): void {
  _switchingProject = true
}

/** Leave the switch window; runs in the switch's finally block. */
export function endSwitchProject(): void {
  _switchingProject = false
}

/** The in-flight switch, if any, for concurrent callers to wait on. */
export function getSwitchProjectInflight(): Promise<GraphMeta[]> | null {
  return _switchProjectInflight
}

/** Assigned synchronously — no await between the guard exit and this call. */
export function setSwitchProjectInflight(p: Promise<GraphMeta[]> | null): void {
  _switchProjectInflight = p
}

/** True while saves must be dropped to avoid recreating an abandoned folder. */
export function isSuppressOutgoingSave(): boolean {
  return _suppressOutgoingSave
}

export function setSuppressOutgoingSave(v: boolean): void {
  _suppressOutgoingSave = v
}

/** True when either switch guard blocks an outgoing save. */
export function isOutgoingSaveBlocked(): boolean {
  return _switchingProject || _suppressOutgoingSave
}

/** Claim the next monotonically increasing load token. */
export function nextLoadRequestId(): number {
  return ++_loadRequestId
}

/** True when `id` is still the most recently claimed load token. */
export function isLatestLoadRequest(id: number): boolean {
  return id === _loadRequestId
}

export function hasDraggingNodeId(id: string): boolean {
  return _draggingNodeIds.has(id)
}

export function addDraggingNodeId(id: string): void {
  _draggingNodeIds.add(id)
}

export function deleteDraggingNodeId(id: string): void {
  _draggingNodeIds.delete(id)
}

export function clearDraggingNodeIds(): void {
  _draggingNodeIds.clear()
}

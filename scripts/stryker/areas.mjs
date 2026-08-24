// SPDX-License-Identifier: MIT

/** Shared mutation-area metadata — single source for Stryker configs and `analyze:mutation:changed`. */

/** @typedef {{ mutate: string[], reportDir: string, breakAt: number, touch: string[], touchExclude?: string[] }} MutationArea */

/** @type {Record<string, MutationArea>} */
export const mutationAreas = {
  schema: {
    mutate: ['packages/schema/src/**/*.ts', '!packages/schema/src/**/*.test.ts'],
    reportDir: 'reports/mutation/schema',
    breakAt: 89,
    touch: ['packages/schema/src/'],
  },
  store: {
    mutate: ['src/store/slices/graph-editing.ts', 'src/store/slices/graph-management.ts'],
    reportDir: 'reports/mutation/store',
    breakAt: 69,
    touch: [
      'src/store/slices/graph-editing.ts',
      'src/store/slices/graph-editing.test.ts',
      'src/store/slices/graph-management.ts',
      'src/store/slices/graph-management.test.ts',
    ],
  },
  workspace: {
    mutate: [
      'src/lib/workspace/**/*.ts',
      '!src/lib/workspace/**/*.test.ts',
      '!src/lib/workspace/watch.ts',
      '!src/lib/workspace/scope.ts',
      '!src/lib/workspace/index.ts',
    ],
    reportDir: 'reports/mutation/workspace',
    breakAt: 61,
    touch: ['src/lib/workspace/'],
    touchExclude: [
      'src/lib/workspace/watch.ts',
      'src/lib/workspace/scope.ts',
      'src/lib/workspace/index.ts',
    ],
  },
  mentor: {
    // Keep the legacy mentor context and its untrusted-data/injection-safety
    // boundaries under the retained mutation floor. Graph queries have their
    // own area below, so the new tool surface cannot dilute this ratchet.
    mutate: ['src/llm/context.ts', 'src/llm/graphHandles.ts', 'src/data/fsrsDueQueue.ts'],
    reportDir: 'reports/mutation/mentor',
    breakAt: 84,
    touch: [
      'src/llm/context.ts',
      'src/llm/context.test.ts',
      'src/llm/graphHandles.ts',
      'src/llm/graphHandles.test.ts',
      'src/data/fsrsDueQueue.ts',
      'src/data/fsrsDueQueue.test.ts',
    ],
  },
  graphTools: {
    // Pure graph queries only. The SDK adapter wrappers are intentionally
    // outside this area because they are thin integration glue.
    mutate: ['src/llm/tools.ts:31-240'],
    reportDir: 'reports/mutation/graph-tools',
    breakAt: 91,
    touch: ['src/llm/tools.ts', 'src/llm/tools.test.ts'],
  },
}

/** Stable run order for changed-file mutation selection. */
export const mutationAreaOrder = ['schema', 'store', 'workspace', 'mentor', 'graphTools']

const STRYKER_DIR = 'scripts/stryker/'

/** @param {string} file @param {string} prefix */
function matchesTouch(file, prefix) {
  if (file === prefix) return true
  if (prefix.endsWith('/')) return file.startsWith(prefix)
  return file.startsWith(`${prefix}.`)
}

/** @param {string} file @returns {string[]} */
function areasFromStrykerConfig(file) {
  if (file === `${STRYKER_DIR}areas.mjs`) return [...mutationAreaOrder]
  if (!file.startsWith(STRYKER_DIR) || !file.endsWith('.mjs')) return []
  const name = file.slice(STRYKER_DIR.length, -4)
  if (name === 'base' || name === 'changed' || !mutationAreas[name]) return []
  if (name === 'mentor') return ['mentor', 'graphTools']
  return [name]
}

/** @param {string} file @returns {string[]} */
function areasFromSourceTouch(file) {
  const hit = []
  for (const id of mutationAreaOrder) {
    const area = mutationAreas[id]
    if (area.touchExclude?.includes(file)) continue
    if (area.touch.some((prefix) => matchesTouch(file, prefix))) hit.push(id)
  }
  return hit
}

/**
 * Map changed repo paths to mutation area ids (includes co-located tests).
 * @param {string[]} files
 * @returns {string[]}
 */
export function areasForChangedFiles(files) {
  const hit = new Set()
  for (const file of files) {
    for (const id of areasFromStrykerConfig(file)) hit.add(id)
    for (const id of areasFromSourceTouch(file)) hit.add(id)
  }
  return mutationAreaOrder.filter((id) => hit.has(id))
}

// SPDX-License-Identifier: MIT

/** Shared mutation-area metadata — single source for Stryker configs and `analyze:mutation:changed`. */

/** @typedef {{ mutate: string[], reportDir: string, breakAt: number, touch: string[], touchExclude?: string[] }} MutationArea */

/** @type {Record<string, MutationArea>} */
export const mutationAreas = {
  formats: {
    mutate: ['packages/formats/src/**/*.ts', '!packages/formats/src/**/*.test.ts'],
    reportDir: 'reports/mutation/formats',
    breakAt: 89,
    touch: ['packages/formats/src/'],
  },
  types: {
    mutate: ['packages/types/src/index.ts'],
    reportDir: 'reports/mutation/types',
    breakAt: 95,
    touch: ['packages/types/src/index.ts', 'packages/types/src/index.test.ts'],
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
    mutate: ['src/llm/context.ts', 'src/data/fsrsDueQueue.ts'],
    reportDir: 'reports/mutation/mentor',
    breakAt: 84,
    touch: [
      'src/llm/context.ts',
      'src/llm/context.test.ts',
      'src/data/fsrsDueQueue.ts',
      'src/data/fsrsDueQueue.test.ts',
    ],
  },
}

/** Stable run order — matches `pnpm run analyze:mutation`. */
export const mutationAreaOrder = ['formats', 'types', 'store', 'workspace', 'mentor']

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

// SPDX-License-Identifier: MIT

/** Minimal on-disk graph document JSON for workspace integration tests. */
export function graphDocumentJson(file: {
  id?: string
  name: string
  updatedAt?: number
  concepts?: Array<{ id: string; label: string; x?: number; y?: number }>
  relations?: Array<{ id: string; source: string; target: string; type?: string }>
}): string {
  return JSON.stringify({
    version: 1,
    vocabulary: {
      id: '@nesso-how/vocab-learning',
      version: '0.1.0',
    },
    name: file.name,
    ...(file.id !== undefined && { id: file.id }),
    ...(file.updatedAt !== undefined && { updatedAt: file.updatedAt }),
    concepts: file.concepts ?? [],
    relations: file.relations ?? [],
  })
}

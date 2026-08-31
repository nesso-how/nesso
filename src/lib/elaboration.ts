// SPDX-License-Identifier: MIT
import type { ConceptElaboration } from '@/types/graph'

/** Definition-only update that preserves existing notes verbatim. */
export function withDefinition(
  elab: ConceptElaboration | undefined,
  definition: string,
): ConceptElaboration {
  return elab?.notes !== undefined ? { definition, notes: elab.notes } : { definition }
}

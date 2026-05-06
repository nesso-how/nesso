// SPDX-License-Identifier: MIT
/** Per-handle ids on `ConceptNode`. Required under `ConnectionMode.Loose`: @xyflow/system `getHandle` picks `handles[0]` when id is missing, which is always the source handle first. */

export const CONCEPT_HANDLE_OUT = 'out'

export const CONCEPT_HANDLE_IN = 'in'

// SPDX-License-Identifier: MIT

import { area } from './base.mjs'
import { mutationAreas } from './areas.mjs'

// @nesso-how/types runtime helpers (#55 rollout): the FSRS field <-> ts-fsrs
// `Card` mapping (`nodeToCard`), fresh-review defaults, and the graph-display
// merge logic. The rest of the package is type-only (erased at runtime, nothing
// to mutate).
//
// Baseline: 97.14% (34/35) — near the equivalent-mutant ceiling. `break` 95.
const { mutate, reportDir, breakAt } = mutationAreas.types
export default area({ mutate, reportDir, breakAt })

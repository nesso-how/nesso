// SPDX-License-Identifier: MIT

import { area } from './stryker.base.mjs'

// @nesso-how/types runtime helpers (#55 rollout): the FSRS field <-> ts-fsrs
// `Card` mapping (`nodeToCard`), fresh-review defaults, and the graph-display
// merge logic. The rest of the package is type-only (erased at runtime, nothing
// to mutate).
//
// Baseline: 97.14% (34/35) — near the equivalent-mutant ceiling. `break` 95.
export default area({
  mutate: ['packages/types/src/index.ts'],
  reportDir: 'reports/mutation/types',
  breakAt: 95,
})

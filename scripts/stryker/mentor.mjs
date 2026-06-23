// SPDX-License-Identifier: MIT

import { area } from './base.mjs'
import { mutationAreas } from './areas.mjs'

// Mentor / review pure logic (#55 rollout): the FSRS-aware strength + prompt
// context that feeds Socrates (`src/llm/context.ts`) and the due-queue ordering
// for review (`src/data/fsrsDueQueue.ts`). The network transport (`completion.ts`)
// stays out of scope. The `nodeToCard` FSRS field
// mapping lives in `packages/types` and is graded by the `types` area.
//
// Baseline: 87.50% (112/128). The survivors are mostly equivalent — the
// trailing-word regex and `<=`/`>=` boundary mutants in the token-truncation
// helpers (unreachable exact-length inputs). `break` sits a couple points under.
const { mutate, reportDir, breakAt } = mutationAreas.mentor
export default area({ mutate, reportDir, breakAt })

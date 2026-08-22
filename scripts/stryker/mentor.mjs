// SPDX-License-Identifier: MIT

import { area } from './base.mjs'
import { mutationAreas } from './areas.mjs'

// Mentor / review pure logic (#55 rollout): the FSRS-aware strength + prompt
// context that feeds Socrates (`src/llm/context.ts`) and the due-queue ordering
// for review (`src/data/fsrsDueQueue.ts`). The network transport (`completion.ts`)
// and graph query helpers (`tools.ts`) stay out of scope. The `nodeToCard` FSRS
// field mapping lives in `src/types/settings.ts` and is graded by this area.
//
// Baseline: 87.50% (112/128). The survivors are mostly equivalent — the
// trailing-word regex and `<=`/`>=` boundary mutants in the token-truncation
// helpers (unreachable exact-length inputs). `break` sits a couple points under.
// The package scripts pin the selected area. Keep the sibling graph-query area
// as the only supported alternate so an unrelated environment typo cannot
// silently select another registry entry.
const areaId = process.env.NESSO_MUTATION_AREA ?? 'mentor'
if (areaId !== 'mentor' && areaId !== 'graphTools') {
  throw new Error(`Unsupported mutation area: ${areaId}`)
}
const selectedArea = mutationAreas[areaId]
if (!selectedArea) throw new Error(`Missing mutation area: ${areaId}`)
const { mutate, reportDir, breakAt } = selectedArea
export default area({ mutate, reportDir, breakAt })

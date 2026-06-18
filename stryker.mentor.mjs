// SPDX-License-Identifier: MIT

import { area } from './stryker.base.mjs'

// Mentor / review pure logic (#55 rollout): the FSRS-aware strength + prompt
// context that feeds Socrates (`src/llm/context.ts`) and the due-queue ordering
// for review (`src/data/fsrsDueQueue.ts`). The network / WebGPU transports
// (`completion.ts`, `webllm.ts`) stay out of scope. The `nodeToCard` FSRS field
// mapping lives in `packages/types` and is graded by the `types` area.
//
// Baseline: 86.50% (141/163). The survivors are mostly equivalent — the
// trailing-word regex and `<=`/`>=` boundary mutants in the token-truncation
// helpers (unreachable exact-length inputs). `break` sits a couple points under.
export default area({
  mutate: ['src/llm/context.ts', 'src/data/fsrsDueQueue.ts'],
  reportDir: 'reports/mutation/mentor',
  breakAt: 84,
})

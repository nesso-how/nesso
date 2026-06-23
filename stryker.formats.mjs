// SPDX-License-Identifier: MIT

import { area } from './stryker.base.mjs'
import { mutationAreas } from './mutation-areas.mjs'

// @nesso-how/formats — the first area (#55 rollout): pure JSON serialize /
// deserialize / validation logic.
//
// Baseline: 95.74% (90/94 mutants killed). The 4 survivors are all equivalent
// mutants — unkillable without restructuring source: the redundant
// `typeof pos.x/y !== 'number'` guards subsumed by `!Number.isFinite(...)`, the
// `value !== null` arm of `asRecord` (the `null` case returns null either way),
// and the `{ text: '' }` fallback re-defaulted by `text ?? ''`. So ~95.7% is the
// ceiling here; `break` sits a couple points under it. Raise it as the score
// climbs; when a change intentionally lowers it, re-baseline in the same change.
const { mutate, reportDir, breakAt } = mutationAreas.formats
export default area({ mutate, reportDir, breakAt })

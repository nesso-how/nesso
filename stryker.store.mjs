// SPDX-License-Identifier: MIT

import { area } from './stryker.base.mjs'

// Store slices (#55 rollout). Scoped to the two slices with dedicated tests —
// `graph-editing` (in-memory graph mutations, undo/redo, clipboard) and
// `graph-management` (graph CRUD + desktop workspace sync). The untested slices
// (`settings`, `ui`, `desktop-sync`) and the glue (`index.ts`, `db.ts`) are left
// out: mutating them would only add NoCoverage noise, not test-quality signal —
// the same reason `vitest.config.ts` floors `src/store/slices/**` and not the glue.
//
// Baseline: 71.40% (669/937) — editing ~78%, management ~62%. The survivors are
// dominated by equivalent mutants (id-collision Sets that never collide,
// referential-identity micro-optimisations in the selection no-op guards) plus a
// few hard error-rollback / default-workspace branches. `break` sits a couple
// points under. This is a real ratchet target to climb, not a ceiling like
// formats — raise it as the slices gain assertions.
export default area({
  mutate: ['src/store/slices/graph-editing.ts', 'src/store/slices/graph-management.ts'],
  reportDir: 'reports/mutation/store',
  breakAt: 69,
})

// SPDX-License-Identifier: MIT

import { area } from './stryker.base.mjs'
import { mutationAreas } from './mutation-areas.mjs'

// Workspace disk<->IDB layer (#55 rollout) — `.rules/testing.md` flags this as
// the most regression-prone area (manifest merge/reconcile, name dedup, path
// math, sync). Scoped to the pure-logic files; the Tauri boundary glue
// (`watch.ts` file-watch events, `scope.ts` fs-scope grants + dialogs) and the
// barrel (`index.ts`) are left out — their behaviour is integration, verified by
// the e2e layer (#28), so mutating them only adds noise, not test-quality signal.
//
// Baseline: 63.13% (250/396). A real ratchet target to climb. The survivors
// cluster in the async fs functions — disk-error `.catch` fallbacks, the
// rename-vs-rewrite relocate path, and the internal `uniqueFilename` dedup loop —
// which the in-memory fake fs cannot easily fault-inject; the e2e layer (#28) is
// the right place for those. `break` sits a couple points under.
const { mutate, reportDir, breakAt } = mutationAreas.workspace
export default area({ mutate, reportDir, breakAt })

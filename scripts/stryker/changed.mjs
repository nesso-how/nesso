// SPDX-License-Identifier: MIT

import { spawnSync } from 'node:child_process'
import { areasForChangedFiles } from './areas.mjs'

function runGit(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || `git ${args.join(' ')} failed`)
    process.exit(r.status ?? 1)
  }
  return (r.stdout ?? '').trim()
}

/**
 * @param {string} base Ref to diff against (default `main`).
 * @param {boolean} includeWorking Include unstaged + staged edits on top of commits.
 */
function changedFiles(base, includeWorking) {
  const mergeBase = runGit(['merge-base', base, 'HEAD'])
  const committed = runGit(['diff', '--name-only', mergeBase, 'HEAD']).split('\n').filter(Boolean)
  if (!includeWorking) return committed
  const working = runGit(['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean)
  const staged = runGit(['diff', '--name-only', '--cached']).split('\n').filter(Boolean)
  return [...new Set([...committed, ...working, ...staged])]
}

const args = process.argv.slice(2)
let base = 'main'
let includeWorking = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && args[i + 1]) {
    base = args[++i]
  } else if (args[i] === '--working') {
    includeWorking = true
  } else {
    console.error(`Unknown arg: ${args[i]}`)
    process.exit(1)
  }
}

const files = changedFiles(base, includeWorking)
const areas = areasForChangedFiles(files)

if (areas.length === 0) {
  console.log('analyze:mutation:changed — no Stryker areas matched; skipping.')
  process.exit(0)
}

console.log(
  `analyze:mutation:changed — ${areas.join(', ')} (${files.length} changed file(s) vs ${base})`,
)

for (const area of areas) {
  console.log(`\n→ pnpm run analyze:mutation:${area}`)
  const r = spawnSync('pnpm', ['run', `analyze:mutation:${area}`], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log(`\nMutation areas passed: ${areas.join(', ')}`)

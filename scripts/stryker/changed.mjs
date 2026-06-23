// SPDX-License-Identifier: MIT

import { spawnSync } from 'node:child_process'
import { areasForChangedFiles } from './areas.mjs'

/** @param {string[]} args @returns {string} */
function gitOutput(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || `git ${args.join(' ')} failed`)
    process.exit(r.status ?? 1)
  }
  return (r.stdout ?? '').trim()
}

/** @param {string} spec @returns {string[]} */
function gitLines(spec) {
  return gitOutput(spec).split('\n').filter(Boolean)
}

/**
 * @param {string} base Ref to diff against (default `main`).
 * @param {boolean} includeWorking Include unstaged + staged edits on top of commits.
 */
function changedFiles(base, includeWorking) {
  const mergeBase = gitOutput(['merge-base', base, 'HEAD'])
  const committed = gitLines(['diff', '--name-only', mergeBase, 'HEAD'])
  if (!includeWorking) return committed
  return [
    ...new Set([
      ...committed,
      ...gitLines(['diff', '--name-only', 'HEAD']),
      ...gitLines(['diff', '--name-only', '--cached']),
    ]),
  ]
}

/** @param {string[]} argv */
function parseArgs(argv) {
  let base = 'main'
  let includeWorking = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base' && argv[i + 1]) base = argv[++i]
    else if (argv[i] === '--working') includeWorking = true
    else {
      console.error(`Unknown arg: ${argv[i]}`)
      process.exit(1)
    }
  }
  return { base, includeWorking }
}

const { base, includeWorking } = parseArgs(process.argv.slice(2))
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

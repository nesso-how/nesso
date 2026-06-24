/**
 * Cut a Nesso release: bump the synced version across all ten version files,
 * roll CHANGELOG [Unreleased] into a dated section, refresh the lockfile, and verify.
 * Stops before publishing — the tag push (the irreversible, public step) stays manual.
 *
 * Usage:
 *   node scripts/release.mjs [version] [--commit] [--no-verify] [--dry-run] [--yes]
 *
 *   version      explicit NEW version (e.g. 0.1.0-alpha.30, 0.2.0). Default: bump the -alpha.N counter.
 *   --commit     also create the release commit and tag locally (never pushes).
 *   --no-verify  skip pnpm install / build / lint / format:check.
 *   --dry-run    print what would change; write nothing.
 *   --yes        don't prompt on warnings (empty [Unreleased], not on main).
 */

import { readFile, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** Files whose top-level JSON `version` is the synced release version. */
const JSON_VERSION_FILES = [
  'package.json',
  'packages/schema/package.json',
  'packages/graph/package.json',
  'packages/mcp/package.json',
  'packages/vocab-learning/package.json',
  'packages/theme/package.json',
  'src-tauri/tauri.conf.json',
]

/** Rust crate files: Cargo.lock mirrors Cargo.toml and is not refreshed by `pnpm install`. */
const CARGO_VERSION_FILES = ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']

/** @param {string} msg */
function log(msg) {
  console.log(msg)
}

/** @param {string} args @returns {string} */
function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' })
}

/** @param {string} cmd Streams output; throws (non-zero exit) to abort the release. */
function run(cmd) {
  log(`$ ${cmd}`)
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
}

/** @param {string} question @returns {Promise<boolean>} */
async function confirm(question) {
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase()
  rl.close()
  return answer === 'y' || answer === 'yes'
}

/** @param {string} prev @param {string | undefined} explicit @returns {string} */
function nextVersion(prev, explicit) {
  if (explicit) return explicit.replace(/^v/, '')
  const m = prev.match(/^(.*-alpha\.)(\d+)$/)
  if (!m) {
    throw new Error(`cannot auto-increment "${prev}" (not -alpha.N); pass an explicit version`)
  }
  return `${m[1]}${Number(m[2]) + 1}`
}

/** @param {string} rel @param {string} content @returns {string | null} */
function currentVersionOf(rel, content) {
  if (rel.endsWith('.json')) return JSON.parse(content).version ?? null
  const m = content.match(/name = "nesso"\nversion = "([^"]+)"/)
  return m ? m[1] : null
}

/** @param {string} content @param {string} search @param {string} replacement @param {string} rel */
function replaceOnce(content, search, replacement, rel) {
  if (!content.includes(search)) throw new Error(`could not find version marker in ${rel}`)
  return content.replace(search, replacement)
}

/** @param {string} changelog @returns {string} Body between ## [Unreleased] and the next ## [ heading. */
function unreleasedBody(changelog) {
  const start = changelog.indexOf('## [Unreleased]')
  if (start === -1) throw new Error('no ## [Unreleased] heading in CHANGELOG.md')
  const after = changelog.indexOf('\n', start) + 1
  const nextHeading = changelog.indexOf('\n## [', after)
  return changelog.slice(after, nextHeading === -1 ? changelog.length : nextHeading)
}

/** @param {string} changelog @param {string} prev @param {string} next @param {string} date @returns {string} */
function rollChangelog(changelog, prev, next, date) {
  const withSection = changelog.replace(
    '## [Unreleased]\n\n',
    `## [Unreleased]\n\n## [${next}] - ${date}\n\n`,
  )
  if (withSection === changelog) throw new Error('could not locate ## [Unreleased] block to roll')

  const refMatch = withSection.match(/\[Unreleased\]: (\S+)\/compare\/v[\w.-]+\.\.\.HEAD/)
  if (!refMatch) throw new Error('could not find [Unreleased] link reference')
  const base = refMatch[1]

  return withSection.replace(
    refMatch[0],
    `[Unreleased]: ${base}/compare/v${next}...HEAD\n[${next}]: ${base}/compare/v${prev}...v${next}`,
  )
}

/** @param {string} next @param {boolean} committed */
function printNextSteps(next, committed) {
  log('')
  log('Next — the publish step is irreversible, run it yourself:')
  if (!committed) {
    log('  git add -A')
    log(`  git commit -m "chore(release): v${next}"`)
    log(`  git tag v${next}`)
  }
  log('  git push origin HEAD:main')
  log(`  git push origin v${next}   # pushing the tag triggers release.yml and publishes`)
}

async function main() {
  const argv = process.argv.slice(2)
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const positional = argv.filter((a) => !a.startsWith('--'))
  const dryRun = flags.has('--dry-run')
  const doCommit = flags.has('--commit')
  const skipVerify = flags.has('--no-verify')
  const assumeYes = flags.has('--yes')

  const prev = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).version
  const next = nextVersion(prev, positional[0])
  if (prev === next) throw new Error(`new version equals current (${prev})`)
  log(`Releasing ${prev} -> ${next}${dryRun ? ' (dry run)' : ''}`)

  const targets = [...JSON_VERSION_FILES, ...CARGO_VERSION_FILES]
  const contents = new Map()
  const drift = []
  for (const rel of targets) {
    const content = await readFile(join(ROOT, rel), 'utf8')
    contents.set(rel, content)
    const cur = currentVersionOf(rel, content)
    if (cur !== prev) drift.push(`${rel}: ${cur}`)
  }
  if (drift.length) {
    throw new Error(`version drift (expected ${prev}):\n  ${drift.join('\n  ')}`)
  }

  const dirty = git('status --porcelain').trim()
  if (dirty && doCommit) {
    throw new Error(`working tree not clean; --commit needs a clean base:\n${dirty}`)
  }
  if (dirty)
    log('Warning: working tree has uncommitted changes; they will mix into the release diff.')

  const branch = git('rev-parse --abbrev-ref HEAD').trim()
  if (branch !== 'main' && !assumeYes && !dryRun) {
    if (!(await confirm(`Not on main (on "${branch}"). Continue?`))) return
  }

  const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')
  if (!unreleasedBody(changelog).trim() && !assumeYes && !dryRun) {
    if (!(await confirm('[Unreleased] is empty. Roll an empty release section anyway?'))) return
  }

  /** @type {Array<[string, string]>} */
  const writes = []
  for (const rel of JSON_VERSION_FILES) {
    writes.push([
      rel,
      replaceOnce(contents.get(rel), `"version": "${prev}"`, `"version": "${next}"`, rel),
    ])
  }
  for (const rel of CARGO_VERSION_FILES) {
    writes.push([
      rel,
      replaceOnce(
        contents.get(rel),
        `name = "nesso"\nversion = "${prev}"`,
        `name = "nesso"\nversion = "${next}"`,
        rel,
      ),
    ])
  }
  const date = new Date().toISOString().slice(0, 10)
  writes.push(['CHANGELOG.md', rollChangelog(changelog, prev, next, date)])

  if (dryRun) {
    log('Would update:')
    for (const [rel] of writes) log(`  ${rel}`)
    printNextSteps(next, false)
    return
  }

  for (const [rel, content] of writes) await writeFile(join(ROOT, rel), content, 'utf8')
  log(`Bumped ${writes.length} files; CHANGELOG rolled to [${next}] - ${date}.`)

  if (!skipVerify) {
    const json = writes.map(([rel]) => rel).filter((r) => r.endsWith('.json'))
    const md = writes.map(([rel]) => rel).filter((r) => r.endsWith('.md'))
    if (json.length) run(`pnpm exec biome format --write ${json.join(' ')}`)
    if (md.length) run(`pnpm exec prettier --write ${md.join(' ')}`)
    run('pnpm install')
    run('pnpm build')
    run('pnpm lint')
    run('pnpm format:check')
  } else {
    log('Skipped verification (--no-verify).')
  }

  if (doCommit) {
    run('git add -A')
    run(`git commit -m "chore(release): v${next}"`)
    run(`git tag v${next}`)
    log(`Committed and tagged v${next} (not pushed).`)
  }

  printNextSteps(next, doCommit)
}

main().catch((err) => {
  console.error(`release: ${err.message}`)
  process.exitCode = 1
})

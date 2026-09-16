/**
 * Cut a Nesso release: bump the synced version across all nine version files,
 * roll CHANGELOG [Unreleased] into a dated section, refresh the lockfile, and verify.
 * Stops before publishing — the tag push (the irreversible, public step) stays manual.
 *
 * Usage:
 *   node scripts/release.mjs [version] [--commit] [--no-verify] [--dry-run] [--yes]
 *
 *   version      explicit NEW version (e.g. 0.1.0-alpha.30, 0.2.0). Default: bump the numbered prerelease counter.
 *   --commit     also create the release commit and tag locally (never pushes).
 *   --no-verify  skip pnpm install / build / lint / format:check.
 *   --dry-run    print what would change; write nothing.
 *   --yes        don't prompt on warnings (empty [Unreleased], not on main).
 */

import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const NUMERIC_VERSION = '(?:0|[1-9]\\d*)'
const NON_NUMERIC_IDENTIFIER = '[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*'
const PRERELEASE_IDENTIFIER = `(?:${NUMERIC_VERSION}|${NON_NUMERIC_IDENTIFIER})`
const SEMVER_PATTERN = new RegExp(
  `^(${NUMERIC_VERSION})\\.(${NUMERIC_VERSION})\\.(${NUMERIC_VERSION})` +
    `(?:-(${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*))?` +
    `(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`,
)
const NUMERIC_IDENTIFIER_PATTERN = /^(0|[1-9]\d*)$/

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

/** @param {string[]} args @returns {string} */
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
}

/** @param {string} command @param {string[]} [args] @param {object} [options] */
function run(command, args = [], options = {}) {
  log(`$ ${[command, ...args].map((arg) => JSON.stringify(arg)).join(' ')}`)
  execFileSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options })
}

/** @param {string[]} args @param {object} [options] */
function runPnpm(args, options = {}) {
  if (process.platform === 'win32') {
    run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'pnpm', ...args], options)
    return
  }
  run('pnpm', args, options)
}

/** @param {string} question @returns {Promise<boolean>} */
async function confirm(question) {
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase()
  rl.close()
  return answer === 'y' || answer === 'yes'
}

/**
 * @typedef {{ raw: string, major: bigint, minor: bigint, patch: bigint, prerelease: string[], build: string }} ParsedVersion
 */

/** @param {string} value @param {string} label @returns {ParsedVersion} */
function parseVersion(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  const raw = value.replace(/^v/, '')
  const match = SEMVER_PATTERN.exec(raw)
  if (!match) throw new Error(`${label} "${value}" must be valid SemVer`)
  return {
    raw,
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ?? '',
  }
}

/** @param {string} value @param {string} [label] @returns {string} */
export function normalizeVersion(value, label = 'version') {
  return parseVersion(value, label).raw
}

/** @param {string} left @param {string} right @returns {number} */
function compareIdentifiers(left, right) {
  const leftNumeric = NUMERIC_IDENTIFIER_PATTERN.test(left)
  const rightNumeric = NUMERIC_IDENTIFIER_PATTERN.test(right)
  if (leftNumeric && rightNumeric) {
    const leftNumber = BigInt(left)
    const rightNumber = BigInt(right)
    return leftNumber > rightNumber ? 1 : leftNumber < rightNumber ? -1 : 0
  }
  if (leftNumeric) return -1
  if (rightNumeric) return 1
  return left > right ? 1 : left < right ? -1 : 0
}

/** @param {ParsedVersion} left @param {ParsedVersion} right @returns {number} */
function compareCoreVersions(left, right) {
  for (const field of ['major', 'minor', 'patch']) {
    if (left[field] !== right[field]) return left[field] > right[field] ? 1 : -1
  }
  return 0
}

/** @param {string[]} left @param {string[]} right @returns {number} */
function comparePrereleaseVersions(left, right) {
  if (left.length === 0 || right.length === 0) {
    if (left.length === right.length) return 0
    return left.length === 0 ? 1 : -1
  }

  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const comparison = compareIdentifiers(left[index], right[index])
    if (comparison !== 0) return comparison
  }
  return left.length === right.length ? 0 : left.length > right.length ? 1 : -1
}

/** @param {string} left @param {string} right @returns {number} */
export function compareVersions(left, right) {
  const a = parseVersion(left, 'left version')
  const b = parseVersion(right, 'right version')
  return compareCoreVersions(a, b) || comparePrereleaseVersions(a.prerelease, b.prerelease)
}

/** @param {string} prev @param {string | undefined} explicit @returns {string} */
export function nextVersion(prev, explicit) {
  const current = parseVersion(prev, 'current version')
  if (explicit !== undefined) return normalizeVersion(explicit, 'release version')
  const counter = current.prerelease.at(-1)
  if (!counter || !NUMERIC_IDENTIFIER_PATTERN.test(counter)) {
    throw new Error(
      `cannot auto-increment "${current.raw}" (not a numbered prerelease); pass an explicit version`,
    )
  }
  const prefix = current.prerelease.slice(0, -1)
  const prerelease = [...prefix, String(BigInt(counter) + 1n)].join('.')
  const build = current.build ? `+${current.build}` : ''
  return `${current.major}.${current.minor}.${current.patch}-${prerelease}${build}`
}

/** @param {string} current @param {string} next @param {string | null | undefined} latestTag */
export function validateReleaseVersion(current, next, latestTag) {
  const currentComparison = compareVersions(next, current)
  if (currentComparison === 0) throw new Error(`new version equals current (${current})`)
  if (currentComparison < 0) {
    throw new Error(`new version ${next} must be greater than current version ${current}`)
  }

  if (latestTag) {
    const latest = normalizeVersion(latestTag, 'latest release tag')
    if (compareVersions(next, latest) <= 0) {
      throw new Error(`new version ${next} must be greater than latest release ${latestTag}`)
    }
  }
}

/** @returns {string | null} */
function latestReleaseTag() {
  try {
    const tag = git(['describe', '--tags', '--abbrev=0', '--match', 'v*']).trim()
    return tag || null
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 128) {
      return null
    }
    throw error
  }
}

/** @param {Map<string, string>} originals @param {string} root */
async function restoreFiles(originals, root) {
  const failures = []
  for (const [rel, content] of originals) {
    try {
      await writeFile(join(root, rel), content, 'utf8')
    } catch (error) {
      failures.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (failures.length)
    throw new Error(`could not restore release files:\n  ${failures.join('\n  ')}`)
}

/**
 * @param {Array<[string, string]>} writes
 * @param {Map<string, string>} originals
 * @param {() => void | Promise<void>} verify
 * @param {string} [root]
 */
export async function applyWithRollback(writes, originals, verify, root = ROOT) {
  try {
    for (const [rel, content] of writes) await writeFile(join(root, rel), content, 'utf8')
    await verify()
  } catch (error) {
    try {
      await restoreFiles(originals, root)
    } catch (rollbackError) {
      const reason = error instanceof Error ? error.message : String(error)
      const rollbackReason =
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      throw new Error(`release failed: ${reason}; ${rollbackReason}`)
    }
    throw error
  }
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
export function rollChangelog(changelog, prev, next, date) {
  const withSection = changelog.replace(
    '## [Unreleased]\n\n',
    `## [Unreleased]\n\n## [${next}] - ${date}\n\n`,
  )
  if (withSection === changelog) throw new Error('could not locate ## [Unreleased] block to roll')

  const refMatch = withSection.match(/\[Unreleased\]: (\S+)\/compare\/v[0-9A-Za-z.+-]+\.\.\.HEAD/)
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

/** @param {string[]} argv */
function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positional = args.filter((a) => !a.startsWith('--'))
  const knownFlags = new Set(['--dry-run', '--commit', '--no-verify', '--yes'])
  const unknownFlag = [...flags].find((flag) => !knownFlags.has(flag))
  if (unknownFlag) throw new Error(`unknown option: ${unknownFlag}`)
  if (positional.length > 1) throw new Error('only one version may be provided')
  return {
    explicit: positional[0],
    dryRun: flags.has('--dry-run'),
    doCommit: flags.has('--commit'),
    skipVerify: flags.has('--no-verify'),
    assumeYes: flags.has('--yes'),
  }
}

async function getReleaseVersion(explicit) {
  const prev = normalizeVersion(
    JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).version,
    'current package version',
  )
  const next = nextVersion(prev, explicit)
  validateReleaseVersion(prev, next, latestReleaseTag())

  const tag = `v${next}`
  if (
    git(['tag', '--list', tag])
      .split('\n')
      .some((candidate) => candidate.trim() === tag)
  ) {
    throw new Error(`tag ${tag} already exists locally`)
  }
  return { prev, next, tag }
}

/** @param {string} prev @returns {Promise<Map<string, string>>} */
async function readVersionContents(prev) {
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
  return contents
}

/** @param {{ doCommit: boolean, dryRun: boolean, assumeYes: boolean }} options */
async function checkWorkingTree({ doCommit, dryRun, assumeYes }) {
  const dirty = git(['status', '--porcelain']).trim()
  if (dirty && doCommit) {
    throw new Error(`working tree not clean; --commit needs a clean base:\n${dirty}`)
  }
  if (dirty)
    log('Warning: working tree has uncommitted changes; they will mix into the release diff.')

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  if (branch !== 'main' && !assumeYes && !dryRun) {
    return confirm(`Not on main (on "${branch}"). Continue?`)
  }
  return true
}

/** @param {{ dryRun: boolean, assumeYes: boolean }} options @returns {Promise<string | undefined>} */
async function readReleaseChangelog({ dryRun, assumeYes }) {
  const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')
  if (!unreleasedBody(changelog).trim() && !assumeYes && !dryRun) {
    if (!(await confirm('[Unreleased] is empty. Roll an empty release section anyway?'))) {
      return undefined
    }
  }
  return changelog
}

/** @param {Map<string, string>} contents @param {string} prev @param {string} next @param {string} changelog */
function buildReleaseWrites(contents, prev, next, changelog) {
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
  return { writes, date }
}

/** @param {Map<string, string>} contents @param {string} changelog @returns {Promise<Map<string, string>>} */
async function originalReleaseContents(contents, changelog) {
  const originals = new Map(contents)
  originals.set('CHANGELOG.md', changelog)
  originals.set('pnpm-lock.yaml', await readFile(join(ROOT, 'pnpm-lock.yaml'), 'utf8'))
  return originals
}

/** @param {Array<[string, string]>} writes @param {boolean} skipVerify */
function verifyRelease(writes, skipVerify) {
  if (skipVerify) {
    log('Skipped verification (--no-verify).')
    return
  }

  const json = writes.map(([rel]) => rel).filter((r) => r.endsWith('.json'))
  const md = writes.map(([rel]) => rel).filter((r) => r.endsWith('.md'))
  if (json.length) runPnpm(['exec', 'biome', 'format', '--write', ...json])
  if (md.length) runPnpm(['exec', 'prettier', '--write', ...md])
  runPnpm(['install', '--frozen-lockfile'], {
    env: { ...process.env, CI: 'true' },
  })
  runPnpm(['build'])
  runPnpm(['lint'])
  runPnpm(['format:check'])
}

/** @param {string} next @param {string} tag */
function commitRelease(next, tag) {
  run('git', ['add', '-A'])
  run('git', ['commit', '-m', `chore(release): v${next}`])
  run('git', ['tag', tag])
  log(`Committed and tagged ${tag} (not pushed).`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const { prev, next, tag } = await getReleaseVersion(options.explicit)
  log(`Releasing ${prev} -> ${next}${options.dryRun ? ' (dry run)' : ''}`)

  const contents = await readVersionContents(prev)
  if (!(await checkWorkingTree(options))) return

  const changelog = await readReleaseChangelog(options)
  if (changelog === undefined) return

  const { writes, date } = buildReleaseWrites(contents, prev, next, changelog)
  if (options.dryRun) {
    log('Would update:')
    for (const [rel] of writes) log(`  ${rel}`)
    printNextSteps(next, false)
    return
  }

  const originals = await originalReleaseContents(contents, changelog)
  await applyWithRollback(writes, originals, () => verifyRelease(writes, options.skipVerify))
  log(`Bumped ${writes.length} files; CHANGELOG rolled to [${next}] - ${date}.`)

  if (options.doCommit) commitRelease(next, tag)
  printNextSteps(next, options.doCommit)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  main().catch((err) => {
    console.error(`release: ${err.message}`)
    process.exitCode = 1
  })
}

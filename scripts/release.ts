import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { NessoError } from '@nesso-how/errors'
import { releaseHighlights } from '../shared/whats-new.ts'
import { releaseNotes } from './release-notes.ts'
import releasePackages from './release-packages.json' with { type: 'json' }

type Channel = 'alpha' | 'beta'
type Version = {
  major: number
  minor: number
  patch: number
  channel?: Channel
  prerelease?: number
}

const bumps = ['major', 'minor', 'patch', 'alpha', 'beta'] as const
const usage =
  'usage: pnpm release [version|--major|--minor|--patch|--alpha|--beta] (--preview|--highlights <file>|--no-highlights)'
const help = `${usage}

Release from a clean main branch. Without an argument, release the current version.
Choose an explicit version or bump with --major, --minor, --patch, --alpha or --beta.

Generate CHANGELOG.md from Conventional Commits using cliff.toml, sync built-in
plugins, the packages in scripts/release-packages.json and the example's UI/SDK
dependencies, commit them with the version bump, then tag and atomically push
main and the tag to origin. CI publishes the listed packages with the app's
version and release channel, in list order.
Alpha/beta notes cover changes since the previous release. Stable notes cover
changes since the previous stable release, or all history for the first stable
release. Internal changes are omitted unless breaking.
GitHub releases use the same changelog entry.

--preview            Print the generated changelog entry without changing files or Git.
--highlights <file>  Bundle a translated JSON file in the release commit.
--no-highlights      Release without desktop highlights for this version.
--help, -h  Show this help without changing files or publishing a release.`

function fail(path: string, message: string): never {
  throw new NessoError([{ path, message }])
}

function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : String(unknownError)
    return fail(`${command} ${args.join(' ')}`, message)
  }
}

function parseVersion(input: string): Version {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta)\.(\d+))?$/.exec(input.trim())
  if (!match)
    throw new NessoError([{ path: 'version', message: `expected semver, found ${input}` }])
  const version: Version = {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
  if (match[4] !== undefined) {
    version.channel = match[4] as Channel
    version.prerelease = Number(match[5])
  }
  return version
}

function formatVersion(version: Version): string {
  const stable = `${version.major}.${version.minor}.${version.patch}`
  if (version.channel === undefined) return stable
  return `${stable}-${version.channel}.${version.prerelease as number}`
}

function rank(version: Version): number {
  if (version.channel === undefined) return 2
  return version.channel === 'beta' ? 1 : 0
}

function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1
  const first = a.prerelease ?? 0
  const second = b.prerelease ?? 0
  if (first !== second) return first < second ? -1 : 1
  return 0
}

function resolveTarget(args: string[], current: Version): Version {
  if (args.length === 0) return current
  if (args.length > 1) throw new NessoError([{ path: 'version', message: usage }])
  const arg = args[0] ?? ''
  switch (arg) {
    case '--major':
      return { major: current.major + 1, minor: 0, patch: 0 }
    case '--minor':
      return { major: current.major, minor: current.minor + 1, patch: 0 }
    case '--patch':
      return { major: current.major, minor: current.minor, patch: current.patch + 1 }
    case '--alpha':
    case '--beta': {
      const channel = arg.slice(2) as Channel
      if (current.channel === channel)
        return { ...current, prerelease: (current.prerelease as number) + 1 }
      return {
        major: current.major,
        minor: current.minor,
        patch: current.patch,
        channel,
        prerelease: 1,
      }
    }
    default:
      if (arg.startsWith('-')) throw new NessoError([{ path: 'version', message: usage }])
      return parseVersion(arg)
  }
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      major: { type: 'boolean' },
      minor: { type: 'boolean' },
      patch: { type: 'boolean' },
      alpha: { type: 'boolean' },
      beta: { type: 'boolean' },
      preview: { type: 'boolean' },
      highlights: { type: 'string' },
      'no-highlights': { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  const { preview, highlights, 'no-highlights': noHighlights } = values
  if ([preview, highlights !== undefined, noHighlights].filter(Boolean).length !== 1)
    fail('release', 'choose exactly one of --preview, --highlights <file>, or --no-highlights')
  const location = new URL('../package.json', import.meta.url)
  const raw = readFileSync(location, 'utf8')
  const data = JSON.parse(raw) as { version?: unknown }
  if (typeof data.version !== 'string' || data.version === '')
    fail('package.json', 'missing version')
  const current = parseVersion(data.version)
  const target = resolveTarget(
    [...positionals, ...bumps.filter((bump) => values[bump]).map((bump) => `--${bump}`)],
    current,
  )
  if (compareVersions(target, current) < 0)
    fail(
      'version',
      `target ${formatVersion(target)} is older than current ${formatVersion(current)}`,
    )
  const version = formatVersion(target)
  const tag = `v${version}`
  if (run('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main')
    fail('git', 'must release from main')
  if (run('git', ['status', '--porcelain']) !== '') fail('git', 'working tree is not clean')
  if (run('git', ['tag', '--list', tag]) !== '') fail('git', `tag ${tag} already exists`)
  const tags = run('git', ['tag', '--merged', 'HEAD', '--sort=-version:refname']).split('\n')
  const previous = tags.find((candidate) => {
    if (!/^v\d+\.\d+\.\d+(?:-(alpha|beta)\.\d+)?$/.test(candidate)) return false
    const parsed = parseVersion(candidate)
    return (
      compareVersions(parsed, target) < 0 &&
      (target.channel !== undefined || parsed.channel === undefined)
    )
  })
  const entry =
    run(process.execPath, [
      fileURLToPath(import.meta.resolve('git-cliff/cli')),
      '--config',
      'cliff.toml',
      '--tag-pattern',
      '^$',
      '--tag',
      tag,
      '--strip',
      'all',
      ...(previous ? [`${previous}..HEAD`] : []),
    ]) || `## ${version} — ${new Date().toISOString().slice(0, 10)}\n\nNo user-facing changes.`
  releaseNotes(entry, tag)
  const changelogLocation = new URL('../CHANGELOG.md', import.meta.url)
  const changelog = readFileSync(changelogLocation, 'utf8')
  if (changelog.split('\n').some((line) => line.startsWith(`## ${version} — `))) {
    fail('CHANGELOG.md', `entry for ${tag} already exists`)
  }
  if (preview) {
    console.log(entry)
    return
  }
  const updates = new Map<string, string>()
  const notesPath = `src/whats-new/notes/${version}.json`
  const notesLocation = new URL(`../${notesPath}`, import.meta.url)
  if (highlights !== undefined) {
    const contents = readFileSync(highlights, 'utf8')
    const parsed = releaseHighlights.safeParse(JSON.parse(contents))
    if (!parsed.success)
      throw new NessoError(
        parsed.error.issues.map(({ path, message }) => ({
          path: [highlights, ...path].join(':'),
          message,
        })),
      )
    if (!existsSync(notesLocation))
      updates.set(notesPath, `${JSON.stringify(parsed.data, null, 2)}\n`)
    else if (readFileSync(notesLocation, 'utf8') !== contents)
      fail(notesPath, 'highlights already exist and differ from the supplied file')
  } else if (existsSync(notesLocation)) {
    fail(
      notesPath,
      'highlights already exist; pass them with --highlights or remove them before release',
    )
  }
  if (version !== data.version) {
    const matches = raw.match(/"version":\s*"[^"]*"/g) ?? []
    if (matches.length !== 1) fail('package.json', 'expected exactly one version field')
    updates.set('package.json', raw.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`))
  }
  for (const directory of [
    ...releasePackages,
    ...[
      'kernel-theme',
      'paper-theme',
      'mist-theme',
      'base-vocab',
      'import',
      'export',
      'review',
      'notes',
    ].map((plugin) => `plugins/${plugin}`),
  ]) {
    const path = `${directory}/package.json`
    const packageLocation = new URL(`../${path}`, import.meta.url)
    if (!existsSync(packageLocation)) {
      if (releasePackages.includes(directory)) fail(path, 'release package is missing')
      continue
    }
    let packageRaw = readFileSync(packageLocation, 'utf8')
    const manifest = JSON.parse(packageRaw) as { version?: unknown }
    const matches = packageRaw.match(/"version":\s*"[^"]*"/g) ?? []
    if (typeof manifest.version !== 'string' || matches.length !== 1)
      fail(path, 'expected exactly one version field')
    packageRaw = packageRaw.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`)
    if (directory === 'packages/plugin/example') {
      for (const dependency of ['@nesso-how/ui', '@nesso-how/plugin']) {
        const pattern = new RegExp(`("${dependency}":\\s*")[^"]*(")`, 'g')
        if ([...packageRaw.matchAll(pattern)].length !== 1)
          fail(path, `expected exactly one ${dependency} dependency`)
        packageRaw = packageRaw.replace(pattern, `$1${version}$2`)
      }
    }
    updates.set(path, packageRaw)
  }
  updates.set(
    'CHANGELOG.md',
    `# Changelog\n\n${entry}\n\n${changelog.replace(/^# Changelog\s*/, '')}`,
  )
  if (updates.has(notesPath)) mkdirSync(new URL('.', notesLocation), { recursive: true })
  for (const [path, contents] of updates)
    writeFileSync(new URL(`../${path}`, import.meta.url), contents)
  run('git', ['add', ...updates.keys()])
  run('git', ['commit', '-m', `chore: release ${version}`])
  run('git', ['tag', tag])
  run('git', ['push', '--atomic', 'origin', 'main', tag])
  console.log(tag)
}

try {
  main()
} catch (unknownError) {
  console.error(unknownError instanceof Error ? unknownError.message : unknownError)
  process.exit(1)
}

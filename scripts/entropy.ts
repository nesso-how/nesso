import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { NessoError } from '@nesso-how/errors'

const help = `usage: pnpm entropy [--sessions N]

Print JSON measuring whether the workflow adds entropy over the last N
top-level OpenCode sessions of this project (default 20), next to the N
sessions before them. Each window covers the origin/main commits since its
oldest session started, so fetch origin first. Sessions are read from the
local OpenCode store and never written anywhere.

Code: dead code, complexity, duplication, and styling findings introduced in
the window (fallow audit), and net suppressions (as any, @ts-ignore,
@ts-expect-error, oxlint-disable, fallow-ignore) and words in AGENTS.md files
and .opencode/ added in the window.
Outcome: merged PRs, median PR size in changed lines, fix commits touching
files changed by a feat in the previous 14 days, and reverts. pnpm-lock.yaml
and CHANGELOG.md are ignored.
Process, per session and as window medians: typed prompts after the first,
quoted replies, diff comments, agent questions, compactions, tool errors,
failed shell commands, model switches, files edited three or more times,
tokens, and PRs created.

--sessions N  Sessions per window.
--help, -h    Show this help without measuring.`

const day = 86_400_000
const ignored = new Set(['pnpm-lock.yaml', 'CHANGELOG.md'])
const counts = [
  'prompts',
  'replies',
  'diffComments',
  'questions',
  'compactions',
  'toolErrors',
  'shellFailures',
  'modelSwitches',
  'repeatedEdits',
  'tokens',
] as const
const fallow = fileURLToPath(new URL('../node_modules/.bin/fallow', import.meta.url))

type Commit = {
  time: number
  subject: string
  files: Map<string, number>
}

type Session = Record<(typeof counts)[number], number> & {
  id: string
  title: string
  created: number
  prs: number[]
}

type Part = {
  type?: string
  name?: string
  state?: {
    status?: string
    input?: { command?: unknown; path?: unknown }
    content?: { text?: unknown }[]
    metadata?: { exit?: unknown }
  }
}

type Message = {
  type?: string
  metadata?: { displayText?: unknown; comments?: { type?: unknown; path?: unknown }[] }
  content?: Part[]
}

type Tokens = {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

function fail(path: string, message: string): never {
  throw new NessoError([{ path, message }])
}

function run(command: string, args: string[], allowed = [0]): string {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1 << 30 })
  if (result.error || !allowed.includes(result.status ?? -1))
    fail(`${command} ${args.slice(0, 2).join(' ')}`, result.error?.message ?? result.stderr.trim())
  return result.stdout
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

export function sessionMetrics(data: unknown): Session {
  const { info, messages } = (data ?? {}) as {
    info?: { id?: unknown; title?: unknown; time?: { created?: unknown }; tokens?: Tokens }
    messages?: Message[]
  }
  const tokens = info?.tokens
  if (
    typeof info?.id !== 'string' ||
    typeof info.time?.created !== 'number' ||
    typeof tokens?.cache?.read !== 'number' ||
    !Array.isArray(messages)
  )
    fail('opencode session export', 'unexpected export format')
  const users = messages.filter((message) => message.type === 'user')
  const comments = users.flatMap((message) => message.metadata?.comments ?? [])
  const parts = messages.flatMap((message) =>
    message.type === 'assistant' ? (message.content ?? []) : [],
  )
  const tools = parts.filter((part) => part.type === 'tool')
  const edits = new Map<unknown, number>()
  const prs = new Set<number>()
  let shellFailures = 0
  for (const { name, state } of tools) {
    if (name === 'edit' || name === 'write')
      edits.set(state?.input?.path, (edits.get(state?.input?.path) ?? 0) + 1)
    if (name !== 'shell') continue
    const exit = state?.metadata?.exit
    if (typeof exit === 'number' && exit !== 0) shellFailures++
    const command = state?.input?.command
    if (typeof command !== 'string' || !command.includes('gh pr create')) continue
    const output = (state?.content ?? [])
      .map(({ text }) => (typeof text === 'string' ? text : ''))
      .join('\n')
    for (const [, number] of output.matchAll(/\/pull\/(\d+)/g)) prs.add(Number(number))
  }
  return {
    id: info.id,
    title: typeof info.title === 'string' ? info.title : '',
    created: info.time.created,
    prompts: users.slice(1).filter((message) => message.metadata?.displayText).length,
    replies: comments.filter((comment) => comment.type === 'quote').length,
    diffComments: comments.filter((comment) => comment.path !== undefined).length,
    questions: tools.filter((part) => part.name === 'question').length,
    compactions: messages.filter((message) => message.type === 'compaction').length,
    toolErrors: tools.filter((part) => part.state?.status === 'error').length,
    shellFailures,
    modelSwitches: messages.filter((message) => message.type === 'model-switched').length,
    repeatedEdits: [...edits.values()].filter((count) => count >= 3).length,
    tokens:
      tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write,
    prs: [...prs].sort((a, b) => a - b),
  }
}

function log(args: string[]): Commit[] {
  const output = run('git', [
    'log',
    '--first-parent',
    '--no-renames',
    '--numstat',
    '--format=%x1e%ct%x09%s',
    ...args,
  ])
  return output
    .split('\x1e')
    .slice(1)
    .map((entry) => {
      const [header = '', ...lines] = entry.split('\n')
      const [time = '0', ...subject] = header.split('\t')
      const files = new Map<string, number>()
      for (const line of lines) {
        const [added = '', deleted = '', path] = line.split('\t')
        if (path !== undefined && !ignored.has(path))
          files.set(path, (Number(added) || 0) + (Number(deleted) || 0))
      }
      return { time: Number(time) * 1000, subject: subject.join('\t'), files }
    })
}

function outcomeMetrics(base: string, head: string) {
  const window = log([`${base}..${head}`])
  const start = Math.min(...window.map((commit) => commit.time))
  const earlier = window.length
    ? log([`--since=${new Date(start - 14 * day).toISOString()}`, base])
    : []
  const feats = [...window, ...earlier].filter((commit) =>
    /^feat(\([^)]*\))?!?:/.test(commit.subject),
  )
  const prs = window.filter((commit) => /\(#\d+\)$/.test(commit.subject))
  return {
    mergedPRs: prs.length,
    medianPRSize: median(
      prs.map((commit) => [...commit.files.values()].reduce((total, lines) => total + lines, 0)),
    ),
    fixAfterFeat: window.filter(
      (fix) =>
        /^fix(\([^)]*\))?!?:/.test(fix.subject) &&
        feats.some(
          (feat) =>
            feat.time < fix.time &&
            fix.time - feat.time <= 14 * day &&
            [...fix.files.keys()].some((file) => feat.files.has(file)),
        ),
    ).length,
    reverts: window.filter((commit) => /^revert/i.test(commit.subject)).length,
  }
}

function added(base: string, head: string, paths: string[], measure: (line: string) => number) {
  return run('git', ['diff', '-U0', '--no-color', '--no-renames', base, head, '--', ...paths])
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    .reduce((total, line) => total + (line[0] === '+' ? 1 : -1) * measure(line.slice(1)), 0)
}

function codeMetrics(base: string, head: string) {
  const directory = mkdtempSync(join(tmpdir(), 'nesso-entropy-'))
  try {
    run('git', ['worktree', 'add', '--detach', '--quiet', directory, head])
    const output = run(
      fallow,
      ['audit', '--root', directory, '--base', base, '--format', 'json', '--quiet'],
      [0, 1],
    )
    const { attribution } = JSON.parse(output) as { attribution?: Record<string, unknown> }
    const introduced = (key: string) => {
      const value = attribution?.[`${key}_introduced`]
      return typeof value === 'number' ? value : fail('fallow audit', `missing ${key}_introduced`)
    }
    return {
      deadCode: introduced('dead_code'),
      complexity: introduced('complexity'),
      duplication: introduced('duplication'),
      styling: introduced('styling'),
      suppressionsAdded: added(
        base,
        head,
        ['*.ts', '*.tsx', '*.cts', '*.mts', '*.js', ':!scripts/entropy*'],
        (line) =>
          line.match(/\bas any\b|@ts-ignore|@ts-expect-error|oxlint-disable|fallow-ignore/g)
            ?.length ?? 0,
      ),
      instructionWordsAdded: added(
        base,
        head,
        [':(glob)**/AGENTS.md', '.opencode'],
        (line) => line.split(/\s+/).filter(Boolean).length,
      ),
    }
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', directory])
    rmSync(directory, { recursive: true, force: true })
    spawnSync('git', ['worktree', 'prune'])
  }
}

function measure(sessions: Session[], head: string) {
  const from = new Date(Math.min(...sessions.map((session) => session.created))).toISOString()
  const base = run('git', ['rev-list', '-1', '--first-parent', `--before=${from}`, head]).trim()
  if (!base) fail('git', `no ${head} commit before ${from}`)
  return {
    from,
    base,
    head,
    code: codeMetrics(base, head),
    outcome: outcomeMetrics(base, head),
    process: {
      ...Object.fromEntries(
        counts.map((key) => [key, median(sessions.map((session) => session[key]))]),
      ),
      withoutPR: sessions.filter((session) => session.prs.length === 0).length,
    },
    sessions,
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      sessions: { type: 'string', default: '20' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  const count = Number(values.sessions)
  if (!Number.isInteger(count) || count < 1) fail('--sessions', 'expected a positive integer')
  const list = JSON.parse(
    run('opencode', ['session', 'list', '--format', 'json', '--max-count', String(count * 2)]),
  ) as unknown
  if (!Array.isArray(list) || list.some((entry) => typeof entry?.id !== 'string'))
    fail('opencode session list', 'unexpected list format')
  const sessions = (list as { id: string }[])
    .map(({ id }) => sessionMetrics(JSON.parse(run('opencode', ['session', 'export', id]))))
    .sort((a, b) => b.created - a.created)
  if (sessions.length === 0) fail('opencode session list', 'no sessions in this project')
  const head = run('git', ['rev-parse', 'origin/main']).trim()
  const current = measure(sessions.slice(0, count), head)
  const previous =
    sessions.length > count ? measure(sessions.slice(count), current.base) : undefined
  console.log(JSON.stringify({ current, previous }, null, 2))
}

if (import.meta.main) {
  try {
    main()
  } catch (unknownError) {
    console.error(unknownError instanceof Error ? unknownError.message : unknownError)
    process.exit(1)
  }
}

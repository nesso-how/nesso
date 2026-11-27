import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { NessoError } from '@nesso-how/errors'
import { runBenchmarks, type Sample } from './perf/benchmarks.ts'
import { defaultGraphOptions, writeDocument } from './perf/generate.ts'
import { growth, summarize } from './perf/stats.ts'

const usage = 'usage: pnpm perf [options] | pnpm perf app [options]'
const help = `${usage}

Benchmark how core costs scale with graph size, or open the production app on a
generated graph for DevTools profiling. Run on an idle machine; see docs/profiling.md.

Benchmark options:
  --sizes <list>       Comma-separated concept counts (default 500,1000,2000,5000,10000)
  --filter <text>      Run only benchmarks whose name contains the text
  --cpu-prof           Write one CPU profile per benchmark and size to a new temporary folder
  --base <ref>         Also run on a Git ref in a temporary worktree and compare
  --json               Print raw samples as JSON

App options:
  --concepts <n>       Concepts in the generated graph (default 5000)

The app builds the production renderer, writes the graph to a new temporary data
folder, and opens the desktop app on it. Open DevTools from View → Toggle
Developer Tools.

--help, -h  Show this help.`

const fail = (message: string): never => {
  throw new NessoError([{ path: 'perf', message: `${message}\n${usage}` }])
}
const integer = (value: string, name: string, min: number) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min)
    fail(`Expected --${name} to be an integer of at least ${min}`)
  return parsed
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    sizes: { type: 'string' },
    filter: { type: 'string' },
    'cpu-prof': { type: 'boolean' },
    base: { type: 'string' },
    json: { type: 'boolean' },
    concepts: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

const root = fileURLToPath(new URL('..', import.meta.url))

const openApp = async () => {
  const concepts = values.concepts ? integer(values.concepts, 'concepts', 1) : 5000
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })
  const directory = mkdtempSync(path.join(tmpdir(), 'nesso-perf-app-'))
  await writeDocument(directory, defaultGraphOptions(concepts))
  console.log(`Data folder: ${directory}\nOpen DevTools from View → Toggle Developer Tools.`)
  const electron: string = createRequire(import.meta.url)('electron')
  const child = spawn(electron, ['.'], {
    cwd: root,
    env: { ...process.env, NESSO_USER_DATA: directory, ELECTRON_RUN_AS_NODE: undefined },
    stdio: 'inherit',
  })
  await once(child, 'close')
  console.log(`Data folder kept at ${directory}`)
}

const runBase = (ref: string, args: string[]): Sample[] => {
  const worktree = mkdtempSync(path.join(tmpdir(), 'nesso-perf-base-'))
  const git = (...command: string[]) => execFileSync('git', command, { cwd: root, stdio: 'pipe' })
  git('worktree', 'add', '--detach', worktree, ref)
  try {
    for (const file of ['scripts/perf.ts', 'scripts/perf'])
      cpSync(path.join(root, file), path.join(worktree, file), { recursive: true })
    execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
      cwd: worktree,
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    const output = execFileSync(
      process.execPath,
      ['--expose-gc', 'scripts/perf.ts', ...args, '--json'],
      { cwd: worktree, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 256 * 1024 * 1024 },
    )
    return JSON.parse(output.toString()) as Sample[]
  } finally {
    git('worktree', 'remove', '--force', worktree)
  }
}

const profiler = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nesso-perf-profiles-'))
  const session = new Session()
  session.connect()
  return {
    directory,
    profile: async (name: string, size: number, run: () => Promise<void>) => {
      await session.post('Profiler.enable')
      await session.post('Profiler.start')
      try {
        await run()
      } finally {
        const { profile } = await session.post('Profiler.stop')
        const file = `${name.replaceAll(/[^a-z0-9]+/gi, '-')}-${size}.cpuprofile`
        writeFileSync(path.join(directory, file), JSON.stringify(profile))
      }
    },
  }
}

const milliseconds = (value: number) =>
  `${value < 1 ? value.toFixed(3) : value < 100 ? value.toFixed(2) : value.toFixed(0)} ms`
const percent = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`

const report = (head: Sample[], base?: Sample[]) => {
  const sizes = [...new Set(head.map(({ size }) => size))]
  const summary = (samples: Sample[] | undefined, name: string) =>
    new Map(
      samples
        ?.filter((sample) => sample.name === name)
        .map(({ size, samples }) => [size, summarize(samples)]),
    )
  const exponent = (points: Map<number, { median: number }>) => {
    const value = growth([...points].map(([size, { median }]) => ({ size, median })))
    return value === undefined ? '-' : value.toFixed(2)
  }
  const rows = [...new Set(head.map(({ name }) => name))].map((name) => {
    const current = summary(head, name)
    const previous = summary(base, name)
    return [
      name,
      ...sizes.map((size) => {
        const { median, spread } = current.get(size)!
        const before = previous.get(size)?.median
        return `${milliseconds(median)} ${before ? percent(median / before - 1) : `±${Math.round(spread * 100)}%`}`
      }),
      base ? `${exponent(current)} (${exponent(previous)})` : exponent(current),
    ]
  })
  const header = ['benchmark', ...sizes.map(String), base ? 'growth (base)' : 'growth']
  const widths = header.map((_, column) =>
    Math.max(...[header, ...rows].map((row) => row[column].length)),
  )
  for (const row of [header, ...rows])
    console.log(
      row
        .map((cell, column) =>
          column ? cell.padStart(widths[column]) : cell.padEnd(widths[column]),
        )
        .join('  '),
    )
  console.log(
    base
      ? '\nCells show the median and its change from the base.'
      : '\nCells show the median and the interquartile range relative to it.',
  )
}

if (values.help) console.log(help)
else if (positionals[0] === 'app' && positionals.length === 1) await openApp()
else if (positionals.length) fail(`Unknown command: ${positionals.join(' ')}`)
else {
  const sizes = (values.sizes ?? '500,1000,2000,5000,10000')
    .split(',')
    .map((size) => integer(size.trim(), 'sizes', 2))
  const args = process.argv
    .slice(2)
    .filter((arg, index, all) => arg !== '--base' && all[index - 1] !== '--base')
    .filter((arg) => !arg.startsWith('--base=') && arg !== '--cpu-prof' && arg !== '--json')
  const base = values.base ? runBase(values.base, args) : undefined
  const cpu = values['cpu-prof'] ? profiler() : undefined
  const head = await runBenchmarks({ sizes, filter: values.filter, profile: cpu?.profile })
  if (values.json) console.log(JSON.stringify(head))
  else report(head, base)
  if (cpu) console.log(`\nCPU profiles: ${cpu.directory}`)
}

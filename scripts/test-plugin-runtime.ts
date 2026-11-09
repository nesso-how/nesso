import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NessoError } from '@nesso-how/errors'
import { cases } from './plugin-runtime/cases.ts'

const electron: string = createRequire(import.meta.url)('electron')
const harness = fileURLToPath(new URL('./plugin-runtime/harness.ts', import.meta.url))
const filters = process.argv.slice(2)
const selected = Object.entries(cases)
  .flatMap(([scenario, platforms]) => platforms.map((platform) => ({ scenario, platform })))
  .filter(({ scenario, platform }) =>
    filters.every((filter) => filter === scenario || filter === platform),
  )

if (!selected.length)
  throw new NessoError([{ path: 'tests', message: 'No matching scenario or platform' }])

const failures: { path: string; message: string }[] = []
const queue = [...selected]
async function run({ scenario, platform }: (typeof selected)[number]) {
  const name = `${scenario}/${platform}`
  const profile = mkdtempSync(path.join(tmpdir(), `nesso-${scenario}-${platform}-`))
  const child = spawn(
    electron,
    [
      harness,
      scenario,
      platform,
      profile,
      ...(scenario === 'safe-plugins' ? ['--safe-plugins'] : []),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], timeout: 75_000, killSignal: 'SIGKILL' },
  )
  let output = ''
  child.stdout.on('data', (chunk) => (output += chunk))
  child.stderr.on('data', (chunk) => (output += chunk))
  child.on('error', (error) => (output += `${error.message}\n`))
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve) =>
    child.on('close', (code, killed) => resolve([code, killed])),
  )
  process.stdout.write(`${name}: finished\n${output}`)
  if (status === 0) rmSync(profile, { recursive: true, force: true })
  else {
    failures.push({
      path: name,
      message: signal ? `Terminated by ${signal}` : `Exited with status ${status}`,
    })
    console.log(`${name}: failed; profile retained at ${profile}`)
  }
}
await Promise.all(
  Array.from({ length: Math.min(4, selected.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await run(next)
  }),
)
console.log(
  `Plugin runtime checks: ${selected.length - failures.length} passed, ${failures.length} failed`,
)
if (failures.length) {
  console.error(new NessoError(failures))
  process.exitCode = 1
}

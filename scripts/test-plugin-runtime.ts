import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NessoError } from '../src/store/errors.ts'
import { cases } from './plugin-runtime/cases.ts'

const electron: string = createRequire(import.meta.url)('electron')
const harness = fileURLToPath(new URL('./plugin-runtime/harness.ts', import.meta.url))
const filters = process.argv.slice(2)
const selected = Object.entries(cases).flatMap(([scenario, platforms]) => platforms.map((platform) => ({ scenario, platform })))
  .filter(({ scenario, platform }) => filters.every((filter) => filter === scenario || filter === platform))

if (!selected.length) throw new NessoError([{ path: 'tests', message: 'No matching scenario or platform' }])

const failures: { path: string; message: string }[] = []
for (const { scenario, platform } of selected) {
  const name = `${scenario}/${platform}`
  const profile = mkdtempSync(path.join(tmpdir(), `nesso-${scenario}-${platform}-`))
  console.log(`${name}: starting`)
  const result = spawnSync(electron, [harness, scenario, platform, profile], { stdio: 'inherit', timeout: 75_000, killSignal: 'SIGKILL' })
  if (result.status === 0) rmSync(profile, { recursive: true, force: true })
  else {
    const message = result.error?.message ?? (result.signal ? `Terminated by ${result.signal}` : `Exited with status ${result.status}`)
    failures.push({ path: name, message })
    console.error(`${name}: failed; profile retained at ${profile}`)
  }
}
console.log(`Plugin runtime checks: ${selected.length - failures.length} passed, ${failures.length} failed`)
if (failures.length) {
  console.error(new NessoError(failures))
  process.exitCode = 1
}

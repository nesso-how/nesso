import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { NessoError } from '@nesso-how/errors'
import { scenarios } from './scenarios.ts'

const electron: string = createRequire(import.meta.url)('electron')
const harness = fileURLToPath(new URL('./harness.ts', import.meta.url))
const filters = process.argv.slice(2)
const selected = Object.entries(scenarios)
  .flatMap(([scenario, { platforms, args = [] }]) =>
    platforms.map((platform) => ({ scenario, platform, args })),
  )
  .filter(({ scenario, platform }) =>
    filters.every((filter) => filter === scenario || filter === platform),
  )

if (!selected.length)
  throw new NessoError([{ path: 'e2e', message: 'No matching scenario or platform' }])

describe('e2e', { concurrency: 4 }, () => {
  for (const [index, { scenario, platform, args }] of selected.entries())
    it(`${scenario}/${platform}`, async () => {
      const profile = mkdtempSync(path.join(tmpdir(), `nesso-${scenario}-${platform}-`))
      const command = [harness, scenario, platform, profile, ...args]
      const child = spawn(
        process.platform === 'linux' ? 'xvfb-run' : electron,
        process.platform === 'linux'
          ? ['-n', String(99 + index), '-s', '-screen 0 1280x800x24', electron, ...command]
          : command,
        { stdio: ['ignore', 'pipe', 'pipe'], timeout: 75_000, killSignal: 'SIGKILL' },
      )
      let output = ''
      child.stdout.on('data', (chunk) => (output += chunk))
      child.stderr.on('data', (chunk) => (output += chunk))
      const [status, signal] = await once(child, 'close')
      if (status !== 0)
        throw new NessoError([
          {
            path: `${scenario}/${platform}`,
            message: `${signal ? `Terminated by ${signal}` : `Exited with status ${status}`}; profile retained at ${profile}\n${output}`,
          },
        ])
      rmSync(profile, { recursive: true, force: true })
    })
})

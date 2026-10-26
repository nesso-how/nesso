import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NessoError } from '@nesso-how/errors'

const [executable] = process.argv.slice(2)
if (!executable || !existsSync(executable)) throw new NessoError([{ path: 'startup-check', message: 'Expected a packaged app executable path' }])
const profile = mkdtempSync(path.join(tmpdir(), 'nesso-desktop-startup-'))
const marker = path.join(profile, 'startup-ready')
try {
  for (const stage of ['first launch', 'restart']) {
    rmSync(marker, { force: true })
    const result = spawnSync(path.resolve(executable), [], {
      env: { ...process.env, NESSO_STARTUP_CHECK_PROFILE: profile, ELECTRON_RUN_AS_NODE: undefined },
      encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL',
    })
    if (result.status !== 0 || !existsSync(marker)) {
      throw new NessoError([{ path: stage, message: `${result.error?.message ?? `Exit status ${result.status}`}\n${result.stdout}\n${result.stderr}` }])
    }
    console.log(`Packaged desktop ${stage}: passed`)
  }
} finally {
  rmSync(profile, { recursive: true, force: true })
}

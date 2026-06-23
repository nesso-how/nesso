// SPDX-License-Identifier: MIT
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser } from '@wdio/globals'
import { resetWorkspaceDir, sleep } from './helpers.js'

/**
 * WebdriverIO + tauri-driver drives the *native* Tauri shell — the layer the
 * Playwright web lane structurally cannot reach (real fs, file watching,
 * desktop-sync). tauri-driver wraps the platform WebDriver (WebKitWebDriver on
 * Linux), so this lane runs on Linux/Windows only; macOS has no Tauri WebDriver.
 *
 * There is no shared spec code with the Playwright lane by design — the split
 * mirrors the product's own `isDesktop()` boundary (issue #28).
 */

const dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = path.resolve(dirname, '..')

const binaryName = process.platform === 'win32' ? 'nesso.exe' : 'nesso'
const application = path.resolve(projectRoot, 'src-tauri', 'target', 'debug', binaryName)

// Resolve tauri-driver portably: an explicit override, else the conventional
// `cargo install` location (~/.cargo/bin) when present, else bare PATH lookup.
// The Docker image puts it on PATH under a different CARGO_HOME, so a hardcoded
// ~/.cargo/bin path would not exist there.
const tauriDriverName = process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver'
const cargoHomeDriver = path.resolve(os.homedir(), '.cargo', 'bin', tauriDriverName)
const tauriDriverBin =
  process.env.TAURI_DRIVER_BIN || (existsSync(cargoHomeDriver) ? cargoHomeDriver : tauriDriverName)

const DRIVER_HOST = '127.0.0.1'
const DRIVER_PORT = 4444

let tauriDriver: ChildProcess | undefined

// Deliberate teardown drops the early-exit guard *before* killing, so the kill's
// own `exit` event is never mistaken for a crash (a synchronous flag would be
// reset before the async `exit` fires, failing an otherwise-green run).
function stopTauriDriver(): void {
  if (!tauriDriver) return
  tauriDriver.removeAllListeners('exit')
  tauriDriver.kill()
  tauriDriver = undefined
}

/** Resolve once tauri-driver is accepting TCP connections on its port. */
async function waitForDriverPort(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect(DRIVER_PORT, DRIVER_HOST)
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => {
        socket.destroy()
        resolve(false)
      })
    })
    if (open) return
    if (Date.now() >= deadline) throw new Error(`tauri-driver not listening on ${DRIVER_PORT}`)
    await sleep(250)
  }
}

// Spawn tauri-driver once for the whole run (not per session): killing and
// rebinding port 4444 between specs races with the next session's connect and
// flakes as UND_ERR_SOCKET. One long-lived driver serves every sequential
// session; the workspace is still reset per spec in `before`.
async function startTauriDriver(): Promise<void> {
  // Point tauri-driver at the native WebKitWebDriver explicitly so session
  // creation does not depend on PATH discovery (a UND_ERR_SOCKET source).
  const webKitDriver = '/usr/bin/WebKitWebDriver'
  const driverArgs =
    process.platform === 'linux' && existsSync(webKitDriver)
      ? ['--native-driver', webKitDriver]
      : []
  tauriDriver = spawn(tauriDriverBin, driverArgs, { stdio: [null, process.stdout, process.stderr] })
  tauriDriver.on('error', (error) => {
    console.error('tauri-driver error:', error)
    process.exit(1)
  })
  // An exit before teardown is a crash; `stopTauriDriver` removes this listener
  // before a deliberate kill, so reaching here is always a fault.
  tauriDriver.on('exit', (code) => {
    console.error('tauri-driver exited unexpectedly with code', code)
    process.exit(1)
  })
  await waitForDriverPort()
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: projectRoot, stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    throw new Error(`\`${command} ${args.join(' ')}\` exited with code ${result.status}`)
  }
}

// On failure, dump the rendered DOM (and a best-effort screenshot) so a CI-only
// failure — this lane cannot run on macOS — is diagnosable from the artifact.
const artifactsDir = path.resolve(dirname, 'artifacts')
async function captureDiagnostics(title: string): Promise<void> {
  const safe = title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60) || 'test'
  try {
    await mkdir(artifactsDir, { recursive: true })
    await writeFile(path.join(artifactsDir, `${safe}.html`), await browser.getPageSource())
    await browser.saveScreenshot(path.join(artifactsDir, `${safe}.png`))
  } catch (error) {
    console.error('diagnostics capture failed:', error)
  }
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  hostname: DRIVER_HOST,
  port: DRIVER_PORT,
  specs: ['./*.e2e.ts'],
  maxInstances: 1,
  capabilities: [
    {
      // @ts-expect-error tauri:options is a tauri-driver extension capability.
      'tauri:options': { application },
    },
  ],
  logLevel: 'warn',
  waitforTimeout: 20_000,
  // The very first WebDriver session is cold — tauri-driver launches
  // WebKitWebDriver for the first time — so the first spec can time out on a
  // slow autosave/render. tauri-driver stays alive across specs, so a re-run
  // executes against a now-warm driver and passes; 2 retries give margin without
  // masking assertion bugs (later specs already run warm and pass first try).
  specFileRetries: 2,
  specFileRetriesDeferred: true,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 240_000 },

  // Build the debug binary the capability points at, then start the single
  // long-lived tauri-driver and wait until it accepts connections. `--no-bundle`
  // skips the installer/dmg; `beforeBuildCommand` (pnpm build) produces the
  // frontend. `tauri::generate_context!` embeds the gitignored icons, so
  // generate them first. Set TAURI_E2E_SKIP_BUILD locally to reuse a binary.
  onPrepare: async () => {
    if (!process.env.TAURI_E2E_SKIP_BUILD) {
      run('pnpm', ['run', 'icons:desktop'])
      run('pnpm', ['tauri', 'build', '--debug', '--no-bundle'])
    }
    await startTauriDriver()
  },

  onComplete: () => {
    stopTauriDriver()
  },

  // Disk is the source of truth on desktop. tauri-driver stays alive across specs,
  // so `beforeSession` runs only once per worker — reset the workspace in `before`
  // (once per spec file, including deferred retries) so graph files from an earlier
  // spec cannot leak into a later one.
  before: async () => {
    await resetWorkspaceDir()
  },

  afterTest: async (test, _context, result) => {
    if (!result.passed) await captureDiagnostics(test.title)
  },
}

for (const signal of ['exit', 'SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, stopTauriDriver)
}

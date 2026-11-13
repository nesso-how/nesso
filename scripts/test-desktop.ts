import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NessoError } from '@nesso-how/errors'

const [executable, ...updates] = process.argv.slice(2)
if (!executable || !existsSync(executable) || !updates.every((file) => existsSync(file)))
  throw new NessoError([
    {
      path: 'startup-check',
      message: 'Expected a packaged app executable path and optional update artifact paths',
    },
  ])
const profile = mkdtempSync(path.join(tmpdir(), 'nesso-desktop-startup-'))
const marker = path.join(profile, 'startup-ready')

const launch = async (stage: string, file: string, env: NodeJS.ProcessEnv, timeout: number) => {
  rmSync(marker, { force: true })
  try {
    await promisify(execFile)(path.resolve(file), [], {
      env: {
        ...process.env,
        ...env,
        NESSO_STARTUP_CHECK_PROFILE: profile,
        ELECTRON_RUN_AS_NODE: undefined,
      },
      timeout,
      killSignal: 'SIGKILL',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const { message, stdout, stderr } = error as Error & { stdout?: string; stderr?: string }
    throw new NessoError([{ path: stage, message: `${message}\n${stdout}\n${stderr}` }])
  }
  if (!existsSync(marker))
    throw new NessoError([{ path: stage, message: 'Startup marker was not written' }])
  console.log(`Packaged desktop ${stage}: passed`)
}

const checkUpdate = async (files: string[]) => {
  let file = files[0]
  const env: NodeJS.ProcessEnv = {}
  if (process.platform === 'linux') {
    const identity = path.join(path.dirname(path.resolve(executable)), 'resources', 'package-type')
    let extension = 'AppImage'
    if (existsSync(identity)) {
      const type = readFileSync(identity, 'utf8').trim()
      if (['deb', 'rpm', 'pacman'].includes(type)) extension = type
    }
    const artifact = files.find((candidate) => candidate.endsWith(`.${extension}`))
    if (!artifact)
      throw new NessoError([
        {
          path: 'update',
          message: `The packaged app requires a .${extension} artifact for the update check`,
        },
      ])
    file = artifact
    env.APPIMAGE = extension === 'AppImage' ? path.resolve(artifact) : undefined
  }
  const name = path.basename(file)
  const content = readFileSync(file)
  const sha512 = createHash('sha512').update(content).digest('base64')
  const feed = [
    'version: 99.0.0',
    'files:',
    `  - url: ${name}`,
    `    sha512: ${sha512}`,
    `    size: ${content.length}`,
    `path: ${name}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n')
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    if (pathname.endsWith('.yml')) response.end(feed)
    else if (pathname === `/${name}`) response.end(content)
    else response.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const copy = mkdtempSync(path.join(tmpdir(), 'nesso-desktop-update-'))
  try {
    let target = executable
    if (process.platform === 'darwin') {
      const bundle = path.resolve(executable, '../../..')
      const destination = path.join(copy, path.basename(bundle))
      execFileSync('ditto', [bundle, destination])
      target = path.join(destination, path.relative(bundle, path.resolve(executable)))
    }
    await launch(
      'update',
      target,
      {
        NESSO_UPDATE_FEED: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
        ...env,
      },
      300_000,
    )
  } finally {
    server.close()
    rmSync(copy, { recursive: true, force: true })
  }
}

try {
  for (const stage of ['first launch', 'restart']) await launch(stage, executable, {}, 60_000)
  if (updates.length) await checkUpdate(updates)
} finally {
  rmSync(profile, { recursive: true, force: true })
}

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

function fixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'nesso-plugin-release-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  const cwd = join(directory, 'project')
  mkdirSync(join(cwd, 'scripts'), { recursive: true })
  mkdirSync(join(cwd, 'packages', 'plugin', 'example'), { recursive: true })
  copyFileSync(
    new URL('../scripts/release-plugin.ts', import.meta.url),
    join(cwd, 'scripts', 'release-plugin.ts'),
  )
  copyFileSync(
    new URL('../scripts/release-common.ts', import.meta.url),
    join(cwd, 'scripts', 'release-common.ts'),
  )
  mkdirSync(join(cwd, 'node_modules', '@nesso-how'), { recursive: true })
  symlinkSync(
    fileURLToPath(new URL('../packages/errors', import.meta.url)),
    join(cwd, 'node_modules', '@nesso-how', 'errors'),
    'junction',
  )
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n')
  writeFileSync(
    join(cwd, 'packages', 'plugin', 'package.json'),
    '{"name":"@nesso/test","version":"0.1.1"}\n',
  )
  writeFileSync(
    join(cwd, 'packages', 'plugin', 'example', 'package.json'),
    '{"name":"@nesso-how/plugin-example","version":"0.1.1","devDependencies":{"@nesso-how/plugin":"0.1.1","esbuild":"^0.28.2"}}\n',
  )
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Release Test')
  git('config', 'user.email', 'release@example.com')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'tag.gpgsign', 'false')
  git('add', '.')
  git('commit', '-m', 'chore: initialize')
  git('init', '--bare', join(directory, 'remote.git'))
  git('remote', 'add', 'origin', join(directory, 'remote.git'))
  const release = (...args: string[]) =>
    execFileSync(process.execPath, ['scripts/release-plugin.ts', ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  const manifest = () =>
    JSON.parse(readFileSync(join(cwd, 'packages', 'plugin', 'package.json'), 'utf8')) as {
      version?: unknown
    }
  const exampleManifest = () =>
    JSON.parse(
      readFileSync(join(cwd, 'packages', 'plugin', 'example', 'package.json'), 'utf8'),
    ) as { version: string; devDependencies: Record<string, string> }
  return { cwd, git, release, manifest, exampleManifest }
}

test('plugin releases synchronize SDK and example versions and dependency, tag plugin-v and push both', (context) => {
  const project = fixture(context)
  project.git('commit', '--allow-empty', '-m', 'feat: extend SDK')
  const tag = project.release('--patch')
  assert.equal(tag, 'plugin-v0.1.2')
  assert.equal(project.manifest().version, '0.1.2')
  assert.equal(project.exampleManifest().devDependencies['@nesso-how/plugin'], '0.1.2')
  assert.equal(project.exampleManifest().devDependencies.esbuild, '^0.28.2')
  assert.equal(project.exampleManifest().version, '0.1.2')
  assert.deepEqual(project.git('show', '--format=', '--name-only', 'HEAD').split('\n'), [
    'packages/plugin/example/package.json',
    'packages/plugin/package.json',
  ])
  assert.equal(project.git('rev-parse', 'HEAD'), project.git('rev-parse', 'plugin-v0.1.2'))
  assert.equal(project.git('status', '--porcelain'), '')
  assert.match(
    project.git('ls-remote', 'origin', 'refs/heads/main', 'refs/tags/plugin-v0.1.2'),
    /refs\/tags\/plugin-v0\.1\.2/,
  )
})

test('plugin releases refuse an existing tag without changing files or history', (context) => {
  const project = fixture(context)
  project.git('tag', 'plugin-v0.1.2')
  const head = project.git('rev-parse', 'HEAD')
  const result = spawnSync(process.execPath, ['scripts/release-plugin.ts', '--patch'], {
    cwd: project.cwd,
    encoding: 'utf8',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /tag plugin-v0\.1\.2 already exists/)
  assert.equal(project.manifest().version, '0.1.1')
  assert.equal(project.exampleManifest().devDependencies['@nesso-how/plugin'], '0.1.1')
  assert.equal(project.exampleManifest().version, '0.1.1')
  assert.equal(project.git('status', '--porcelain'), '')
  assert.equal(project.git('rev-parse', 'HEAD'), head)
})

test('invalid example metadata fails before changing package versions or release history', (context) => {
  for (const invalid of [
    {
      manifest: { version: '0.1.1', devDependencies: {} },
      message: /missing SDK development dependency/,
    },
    {
      manifest: { devDependencies: { '@nesso-how/plugin': '0.1.1' } },
      message: /expected exactly one version field/,
    },
  ]) {
    const project = fixture(context)
    const location = join(project.cwd, 'packages', 'plugin', 'example', 'package.json')
    writeFileSync(location, `${JSON.stringify(invalid.manifest)}\n`)
    project.git('add', location)
    project.git('commit', '-m', 'test: use invalid example metadata')
    const head = project.git('rev-parse', 'HEAD')
    const result = spawnSync(process.execPath, ['scripts/release-plugin.ts', '--patch'], {
      cwd: project.cwd,
      encoding: 'utf8',
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, invalid.message)
    assert.equal(project.manifest().version, '0.1.1')
    assert.equal(project.git('status', '--porcelain'), '')
    assert.equal(project.git('rev-parse', 'HEAD'), head)
    assert.equal(project.git('tag', '--list'), '')
  }
})

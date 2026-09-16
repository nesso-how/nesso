// SPDX-License-Identifier: MIT

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  applyWithRollback,
  compareVersions,
  nextVersion,
  normalizeVersion,
  rollChangelog,
  validateReleaseVersion,
} from './release.mjs'

const SCRIPT = fileURLToPath(new URL('./release.mjs', import.meta.url))

function runRelease(...args) {
  return execFileSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

describe('release version selection', () => {
  it('increments alpha and beta prerelease counters', () => {
    expect(nextVersion('0.1.0-alpha.41')).toBe('0.1.0-alpha.42')
    expect(nextVersion('0.2.0-beta.5')).toBe('0.2.0-beta.6')
    expect(nextVersion('1.0.0-rc.9')).toBe('1.0.0-rc.10')
  })

  it('keeps an explicit version unchanged', () => {
    expect(nextVersion('0.2.0-beta.5', '0.2.0')).toBe('0.2.0')
  })

  it('normalizes valid versions and follows SemVer precedence', () => {
    expect(normalizeVersion('v1.0.0-1a.1')).toBe('1.0.0-1a.1')
    expect(compareVersions('1.0.0-beta.5', '1.0.0-beta.6')).toBe(-1)
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1)
    expect(compareVersions('1.0.0+one', '1.0.0+two')).toBe(0)
    expect(nextVersion('1.0.0-alpha.9007199254740993')).toBe('1.0.0-alpha.9007199254740994')
  })

  it('rolls changelog links containing valid build metadata', () => {
    const changelog = [
      '## [Unreleased]',
      '',
      'Notes',
      '',
      '[Unreleased]: https://github.com/example/nesso/compare/v1.0.0+build.1...HEAD',
    ].join('\n')

    expect(rollChangelog(changelog, '1.0.0+build.1', '1.0.1', '2026-09-16')).toContain(
      '[Unreleased]: https://github.com/example/nesso/compare/v1.0.1...HEAD',
    )
  })

  it('rejects a candidate that is behind the latest tag', () => {
    expect(() => validateReleaseVersion('0.2.0-beta.4', '0.2.0-beta.5', 'v0.2.0-beta.5')).toThrow(
      'must be greater than latest release',
    )
  })

  it('rejects malformed explicit versions before a dry run', () => {
    expect(() => runRelease('not-a-version', '--dry-run')).toThrow('valid SemVer')
    expect(() => runRelease('0.2.0$(printf injected)', '--dry-run')).toThrow('valid SemVer')
  })

  it('rejects a version that is not newer than the latest release', () => {
    expect(() => runRelease('0.2.0-beta.4', '--dry-run')).toThrow('must be greater')
  })

  it('rejects unknown options and multiple version arguments', () => {
    expect(() => runRelease('0.2.0-beta.6', '--unknown', '--dry-run')).toThrow('unknown option')
    expect(() => runRelease('0.2.0-beta.6', '0.2.0', '--dry-run')).toThrow('only one version')
  })

  it('rejects versions without a numeric prerelease counter', () => {
    expect(() => nextVersion('0.2.0')).toThrow('not a numbered prerelease')
  })
})

describe('release preparation', () => {
  it('keeps prepared files when verification succeeds', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nesso-release-'))
    const originals = new Map([['package.json', 'original package']])

    try {
      await writeFile(join(root, 'package.json'), 'original package', 'utf8')
      await applyWithRollback(
        [['package.json', 'prepared package']],
        originals,
        () => undefined,
        root,
      )
      expect(await readFile(join(root, 'package.json'), 'utf8')).toBe('prepared package')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('restores release files when verification fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nesso-release-'))
    const originals = new Map([
      ['package.json', 'original package'],
      ['CHANGELOG.md', 'original changelog'],
      ['pnpm-lock.yaml', 'original lockfile'],
    ])

    try {
      for (const [rel, content] of originals) await writeFile(join(root, rel), content, 'utf8')

      await expect(
        applyWithRollback(
          [
            ['package.json', 'prepared package'],
            ['CHANGELOG.md', 'prepared changelog'],
          ],
          originals,
          async () => {
            await writeFile(join(root, 'pnpm-lock.yaml'), 'verification mutation', 'utf8')
            throw new Error('verification failed')
          },
          root,
        ),
      ).rejects.toThrow('verification failed')

      for (const [rel, content] of originals) {
        expect(await readFile(join(root, rel), 'utf8')).toBe(content)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

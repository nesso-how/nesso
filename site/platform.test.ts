import assert from 'node:assert/strict'
import test from 'node:test'
import { desktopDownload, detectDesktopPlatform } from './platform.ts'

test('desktop downloads match the visitor operating system', () => {
  assert.equal(detectDesktopPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), 'macOS')
  assert.equal(detectDesktopPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0), 'Windows')
  assert.equal(detectDesktopPlatform('Mozilla/5.0 (X11; Linux x86_64)', 0), 'Linux')
})

test('mobile and unrecognized systems do not select desktop downloads', () => {
  for (const userAgent of [
    'Mozilla/5.0 (Linux; Android 16)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)',
    'Mozilla/5.0 (iPad; CPU OS 19_0 like Mac OS X)',
    'Mozilla/5.0 (iPod touch; CPU iPhone OS 19_0 like Mac OS X)',
    'Mozilla/5.0 (X11; CrOS x86_64)',
    'Mozilla/5.0 (X11; Linux aarch64)',
    'Mozilla/5.0 (X11; Linux armv7l)',
    '',
  ]) {
    assert.equal(detectDesktopPlatform(userAgent, 0), 'other')
  }
  assert.equal(detectDesktopPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), 'other')
})

test('desktop downloads point directly to the platform package for the release', () => {
  const version = '1.0.0-alpha.9'
  for (const [platform, suffix] of [
    ['macOS', 'universal.dmg'],
    ['Windows', 'x64.exe'],
    ['Linux', 'x86_64.AppImage'],
  ] as const) {
    assert.deepEqual(desktopDownload(platform, version), {
      label: `Download for ${platform}`,
      href: `https://github.com/nesso-how/nesso/releases/download/v${version}/Nesso-${version}-${suffix}`,
    })
  }
  assert.equal(desktopDownload('other', version), null)
})

// SPDX-License-Identifier: MIT

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCurrentRelease } from './validate-current-release.mjs'

const execFileAsync = promisify(execFile)
export const DEFAULT_MAX_ATTEMPTS = 12
export const DEFAULT_DELAY_MS = 5000
export const DEFAULT_API_TIMEOUT_MS = 10000

export async function waitForCurrentRelease(ref, getLatestTag, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  const sleep =
    options.sleep ?? ((milliseconds) => new Promise((done) => setTimeout(done, milliseconds)))
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const rawTag = await getLatestTag()
      const latestTag = typeof rawTag === 'string' ? rawTag.trim() : rawTag
      validateCurrentRelease(ref, latestTag)
      return latestTag
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) await sleep(delayMs)
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`current release check failed after ${maxAttempts} attempts: ${detail}`)
}

async function readLatestReleaseTag() {
  const { stdout } = await execFileAsync(
    'gh',
    ['api', `repos/${process.env.GITHUB_REPOSITORY}/releases/latest`, '--jq', '.tag_name'],
    { encoding: 'utf8', timeout: DEFAULT_API_TIMEOUT_MS },
  )
  return stdout
}

async function main() {
  const latestTag = await waitForCurrentRelease(process.env.GITHUB_REF, readLatestReleaseTag)
  console.log(`Release is the latest released tag: ${latestTag}`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  try {
    await main()
  } catch (error) {
    console.error(`current-release: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

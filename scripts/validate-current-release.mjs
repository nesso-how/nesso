// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateCurrentRelease(ref, latestTag) {
  if (typeof ref !== 'string' || !/^refs\/tags\/v[^/]+$/.test(ref)) {
    throw new Error(`release requires an exact refs/tags/v* ref; received "${ref ?? ''}"`)
  }

  if (typeof latestTag !== 'string' || !/^v[^/]+$/.test(latestTag)) {
    throw new Error(`release latest signal must be an exact v* tag; received "${latestTag ?? ''}"`)
  }

  const currentTag = ref.slice('refs/tags/'.length)
  if (currentTag !== latestTag) {
    throw new Error(`stale release: ${ref} is not the latest released tag; latest is ${latestTag}`)
  }
}

function main() {
  const latestTag = readFileSync(0, 'utf8').trim()
  validateCurrentRelease(process.env.GITHUB_REF, latestTag)
  console.log(`Release is the latest released tag: ${latestTag}`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(`current-release: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

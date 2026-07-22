// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

export function validateReleaseTag(ref, packageVersion, tauriVersion) {
  if (typeof packageVersion !== 'string' || packageVersion.length === 0) {
    throw new Error('package.json must contain a non-empty string version')
  }

  if (typeof tauriVersion !== 'string' || tauriVersion.length === 0) {
    throw new Error('src-tauri/tauri.conf.json must contain a non-empty string version')
  }

  if (packageVersion !== tauriVersion) {
    throw new Error(
      `release version drift: package.json is "${packageVersion}" but src-tauri/tauri.conf.json is "${tauriVersion}"`,
    )
  }

  if (typeof ref !== 'string' || !/^refs\/tags\/v[^/]+$/.test(ref)) {
    throw new Error(`release requires an exact refs/tags/v* ref; received "${ref ?? ''}"`)
  }

  const expected = `refs/tags/v${packageVersion}`
  if (ref !== expected) {
    throw new Error(`release tag/version mismatch: expected "${expected}", received "${ref}"`)
  }
}

function readJsonVersion(relativePath) {
  let content
  try {
    content = readFileSync(resolve(ROOT, relativePath), 'utf8')
  } catch (error) {
    throw new Error(
      `could not read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  let document
  try {
    document = JSON.parse(content)
  } catch (error) {
    throw new Error(
      `could not parse ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return document && typeof document === 'object' && !Array.isArray(document)
    ? document.version
    : undefined
}

function main() {
  const packageVersion = readJsonVersion('package.json')
  const tauriVersion = readJsonVersion('src-tauri/tauri.conf.json')
  validateReleaseTag(process.env.GITHUB_REF, packageVersion, tauriVersion)
  console.log(
    `Release tag matches package.json and src-tauri/tauri.conf.json versions: ${process.env.GITHUB_REF}`,
  )
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(`release-tag: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

/**
 * Ensures SPDX one-liners in source files matching package.json `"license"` (when present).
 * Usage: node scripts/license-header.mjs [--check] [file...]
 * Without paths: scans default roots. With paths: only those files (lint-staged).
 * Without --check: inserts missing headers. With --check: exit 1 if any file is missing one.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'target', '.git', '.pnpm-store'])

async function readLicenseId() {
  try {
    const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
    if (typeof pkg.license === 'string' && pkg.license.trim()) {
      return pkg.license.trim()
    }
  } catch {
    /* fall through */
  }
  return 'MIT'
}

const SPDX_REGEX = /\bSPDX-License-Identifier:/

/** @returns {Promise<string[]>} */
async function collectByExtRoots(rootsAndExts) {
  const files = []

  /** @param {string} dir @param {string[]} exts */
  async function walk(dir, exts) {
    if (!existsSync(dir)) return
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue
        await walk(full, exts)
      } else if (exts.includes(extname(e.name))) files.push(full)
    }
  }

  for (const { roots, exts } of rootsAndExts) {
    for (const r of roots) await walk(join(ROOT, r), exts)
  }
  return files
}

/** @param {string} content */
function hasSpdxLine(content) {
  return SPDX_REGEX.test(content)
}

/**
 * @param {string} content
 * @param {string} spdxPlain // line without comment wrapper, e.g. "SPDX-License-Identifier: MIT"
 * @returns {string}
 */
function insertJsLike(content, spdxPlain) {
  const line = `// ${spdxPlain}`
  if (hasSpdxLine(content)) return content

  if (content.startsWith('#!')) {
    const nl = content.indexOf('\n')
    if (nl === -1) return `${content}\n${line}\n`
    return `${content.slice(0, nl + 1)}\n${line}\n${content.slice(nl + 1)}`
  }

  /// <reference ... /> and related triple-slash directives must stay first (TypeScript).
  if (/^\/{3}/.test(content)) {
    const m = content.match(/^((?:\/{3}[^\n]*\n)+)(\s*\n)?/)
    if (m && m.index === 0) {
      const head = m[0]
      return `${head}${head.endsWith('\n\n') ? '' : '\n'}${line}\n${content.slice(head.length)}`
    }
  }

  return `${line}\n${content}`
}

/**
 * @param {string} content
 * @param {string} spdxPlain
 * @returns {string}
 */
function insertCss(content, spdxPlain) {
  if (hasSpdxLine(content)) return content
  const line = `/* ${spdxPlain} */`
  return `${line}\n${content}`
}

/**
 * @param {string} content
 * @param {string} spdxPlain
 * @returns {string}
 */
function insertHtml(content, spdxPlain) {
  if (hasSpdxLine(content)) return content
  const line = `<!-- ${spdxPlain} -->`
  const trimmed = content.replace(/^\uFEFF?/, '')
  if (/^<!DOCTYPE/i.test(trimmed)) {
    const nl = trimmed.indexOf('\n')
    if (nl !== -1) {
      return `${trimmed.slice(0, nl + 1)}${line}\n${trimmed.slice(nl + 1)}`
    }
  }
  return `${line}\n${trimmed}`
}

/** @param {string} ext @returns {'js'|'css'|'html'|null} */
function kindForExt(ext) {
  if (ext === '.css') return 'css'
  if (ext === '.html') return 'html'
  if (['.ts', '.tsx', '.js', '.mjs', '.cjs', '.rs'].includes(ext)) return 'js'
  return null
}

const EXTRA_FILES = new Set(['vite.config.ts', join('src-tauri', 'build.rs'), 'index.html'])

/** Same scope as the default scan, so explicit paths (lint-staged) never widen header coverage. */
function inScope(abs) {
  const rel = relative(ROOT, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) return false
  const ext = extname(abs)
  if ((rel === 'src' || rel.startsWith(`src${sep}`)) && ['.ts', '.tsx', '.css'].includes(ext))
    return true
  if (rel.startsWith(`src-tauri${sep}src${sep}`) && ext === '.rs') return true
  return EXTRA_FILES.has(rel)
}

/** @param {string[]} pathArgs @returns {Array<{path: string, kind: 'js'|'css'|'html'}>} */
function jobsFromPaths(pathArgs) {
  const jobs = []
  for (const raw of pathArgs) {
    const abs = isAbsolute(raw) ? raw : join(ROOT, raw)
    if (!existsSync(abs) || !inScope(abs)) continue
    const kind = kindForExt(extname(abs))
    if (kind) jobs.push({ path: abs, kind })
  }
  return jobs
}

async function collectAllJobs() {
  /** @type {Array<{path: string, kind: 'js'|'css'|'html'}>} */
  const jobs = []

  const groups = await collectByExtRoots([
    { roots: ['src'], exts: ['.ts', '.tsx', '.css'] },
    { roots: ['src-tauri/src'], exts: ['.rs'] },
  ])

  for (const abs of groups) {
    const ext = extname(abs)
    if (ext === '.css') jobs.push({ path: abs, kind: 'css' })
    else jobs.push({ path: abs, kind: 'js' })
  }

  for (const rel of EXTRA_FILES) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) continue
    const ext = extname(abs)
    if (ext === '.html') jobs.push({ path: abs, kind: 'html' })
    else jobs.push({ path: abs, kind: 'js' })
  }

  const dedup = new Map(jobs.map((j) => [j.path, j]))
  return [...dedup.values()].sort((a, b) => a.path.localeCompare(b.path))
}

async function main() {
  const argv = process.argv.slice(2)
  const checkOnly = argv.includes('--check')
  const pathArgs = argv.filter((a) => a !== '--check')
  const licenseId = await readLicenseId()
  const spdxPlain = `SPDX-License-Identifier: ${licenseId}`

  const jobs = pathArgs.length > 0 ? jobsFromPaths(pathArgs) : await collectAllJobs()

  let missing = 0

  for (const { path: abs, kind } of jobs) {
    const raw = await readFile(abs, 'utf8')
    let next =
      kind === 'css'
        ? insertCss(raw, spdxPlain)
        : kind === 'html'
          ? insertHtml(raw, spdxPlain)
          : insertJsLike(raw, spdxPlain)

    if (!hasSpdxLine(raw)) missing++

    if (!checkOnly && next !== raw) {
      await writeFile(abs, next, 'utf8')
    }
  }

  if (checkOnly) {
    if (missing > 0) {
      console.error(`${missing} file(s) missing "${spdxPlain}". Run without --check to insert.`)
      process.exitCode = 1
      return
    }
    console.log(`License headers OK (${jobs.length} files).`)
    return
  }

  console.log(
    missing > 0
      ? `Inserted SPDX in ${missing} file(s); ${jobs.length} total scanned.`
      : `License headers OK (${jobs.length} files; id from package.json when set).`,
  )
}

await main()

// SPDX-License-Identifier: MIT

import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @param {string | undefined} arg
 * @param {boolean} localBranchExists
 * @returns {{ branchArg: string | undefined, issue: string | undefined }}
 */
export function parseArgument(arg, localBranchExists) {
  if (!arg) return { branchArg: undefined, issue: undefined }
  if (localBranchExists) return { branchArg: arg, issue: undefined }
  if (/^#?\d+$/.test(arg)) return { branchArg: undefined, issue: arg.replace(/^#/, '') }

  throw new Error(`No local branch \`${arg}\`; pass an issue number or an existing branch name.`)
}

/**
 * @param {{ branchArg: string | undefined, issue: string | undefined, randomSuffix?: string }} request
 */
export function worktreeSlug({ branchArg, issue, randomSuffix = randomBytes(4).toString('hex') }) {
  return branchArg
    ? branchArg.replaceAll('/', '-')
    : issue
      ? `issue-${issue}`
      : `ws-${randomSuffix}`
}

/** @param {string} command @param {string[]} args @param {string} cwd @param {object} [options] */
function run(command, args, cwd, options = {}) {
  console.log(`$ ${[command, ...args].map((arg) => JSON.stringify(arg)).join(' ')}`)
  return execFileSync(command, args, { cwd, stdio: 'inherit', ...options })
}

/** @param {string} branch */
function hasLocalBranch(branch) {
  return (
    spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
      cwd: ROOT,
      stdio: 'ignore',
    }).status === 0
  )
}

/** @param {string} issue @returns {string} */
function readIssueTitle(issue) {
  const result = spawnSync('gh', ['issue', 'view', issue, '--json', 'title', '--jq', '.title'], {
    cwd: ROOT,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const reason = result.error?.message ?? result.stderr.trim()
    throw new Error(`Issue #${issue} not found${reason ? `: ${reason}` : ''}`)
  }

  return result.stdout.trim()
}

/** @returns {string} */
function defaultBranch() {
  const result = spawnSync('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const remoteHead = result.status === 0 ? result.stdout.trim() : ''
  return remoteHead.replace(/^origin\//, '') || 'main'
}

export function main() {
  const arg = process.argv[2]
  const request = parseArgument(arg, arg ? hasLocalBranch(arg) : false)
  const title = request.issue ? readIssueTitle(request.issue) : undefined
  const slug = worktreeSlug(request)
  const worktree = join(ROOT, '.worktrees', slug)

  if (!existsSync(worktree)) {
    mkdirSync(join(ROOT, '.worktrees'), { recursive: true })

    if (request.branchArg) {
      run('git', ['worktree', 'add', worktree, request.branchArg], ROOT)
    } else {
      run('git', ['worktree', 'add', worktree, '-b', slug, defaultBranch()], ROOT)
    }

    const installEnv = { ...process.env, NESSO_SKIP_PREPARE_BUILD: '1' }
    run('pnpm', ['install', '--frozen-lockfile'], worktree, { env: installEnv })
    run('pnpm', ['run', 'build'], worktree)
    run('pnpm', ['run', 'build:mcp'], worktree)
  }

  const suffix = title ? ` for issue #${request.issue} (${title})` : ''
  console.log(`Worktree ready${suffix}: ${worktree} (branch ${request.branchArg ?? slug})`)
  console.log(`Next: cd .worktrees/${slug} && opencode`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined

if (invokedPath === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { parseArgument, worktreeSlug } from './worktree.mjs'

describe('worktree arguments', () => {
  it('adopts an existing local branch', () => {
    expect(parseArgument('feat/example', true)).toEqual({
      branchArg: 'feat/example',
      issue: undefined,
    })
  })

  it('turns an issue number or #number into an issue request', () => {
    expect(parseArgument('42', false)).toEqual({ branchArg: undefined, issue: '42' })
    expect(parseArgument('#43', false)).toEqual({ branchArg: undefined, issue: '43' })
  })

  it('creates a random worktree request when no argument is supplied', () => {
    expect(parseArgument(undefined, false)).toEqual({ branchArg: undefined, issue: undefined })
    expect(worktreeSlug({ branchArg: undefined, issue: undefined, randomSuffix: 'abcd1234' })).toBe(
      'ws-abcd1234',
    )
  })

  it('rejects an unknown non-issue argument', () => {
    expect(() => parseArgument('not-a-local-branch', false)).toThrow(
      'No local branch `not-a-local-branch`; pass an issue number or an existing branch name.',
    )
  })

  it('normalizes branch names for worktree directories', () => {
    expect(worktreeSlug({ branchArg: 'feat/example', issue: undefined })).toBe('feat-example')
    expect(worktreeSlug({ branchArg: undefined, issue: '42' })).toBe('issue-42')
  })
})

// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { joinPath, normalizePath, projectDisplayName, projectNameFromPath } from './paths'

describe('joinPath', () => {
  it('joins parts with a single slash and drops empty segments', () => {
    expect(joinPath('a', 'b', 'c')).toBe('a/b/c')
    expect(joinPath('a', '', 'c')).toBe('a/c')
    expect(joinPath('/root', 'graphs')).toBe('/root/graphs')
  })

  it('collapses redundant slashes', () => {
    expect(joinPath('a//b', 'c')).toBe('a/b/c')
  })

  it('preserves a leading double slash for Windows UNC paths', () => {
    expect(joinPath('//server', 'share')).toBe('//server/share')
  })
})

describe('normalizePath', () => {
  it('strips trailing slashes', () => {
    expect(normalizePath('/a/b/')).toBe('/a/b')
    expect(normalizePath('/a/b///')).toBe('/a/b')
    expect(normalizePath('/a/b')).toBe('/a/b')
  })
})

describe('projectNameFromPath', () => {
  it('returns the folder basename for posix paths', () => {
    expect(projectNameFromPath('/home/user/My Project')).toBe('My Project')
  })

  it('handles backslash separators', () => {
    expect(projectNameFromPath('C:\\Users\\me\\proj')).toBe('proj')
  })

  it('ignores a trailing slash', () => {
    expect(projectNameFromPath('/home/user/proj/')).toBe('proj')
  })
})

describe('projectDisplayName', () => {
  it('swaps the bundled default path for a friendly label', () => {
    expect(projectDisplayName('/app/data/graphs', '/app/data/graphs', 'My Graphs')).toBe(
      'My Graphs',
    )
    // Trailing-slash difference still resolves to the default.
    expect(projectDisplayName('/app/data/graphs/', '/app/data/graphs', 'My Graphs')).toBe(
      'My Graphs',
    )
  })

  it('falls back to the folder basename for any other path', () => {
    expect(projectDisplayName('/home/user/other', '/app/data/graphs', 'My Graphs')).toBe('other')
    expect(projectDisplayName('/home/user/other', null, 'My Graphs')).toBe('other')
  })
})

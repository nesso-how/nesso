// SPDX-License-Identifier: MIT

import { tauriFsState } from './state'

function collectReadDirEntries(prefix: string): Map<string, boolean> {
  const names = new Map<string, boolean>()
  for (const p of tauriFsState.files.keys()) {
    if (!p.startsWith(prefix)) continue
    const rest = p.slice(prefix.length)
    const i = rest.indexOf('/')
    names.set(i === -1 ? rest : rest.slice(0, i), i === -1)
  }
  for (const d of tauriFsState.dirs) {
    if (!d.startsWith(prefix)) continue
    const rest = d.slice(prefix.length)
    if (!rest) continue
    const i = rest.indexOf('/')
    const name = i === -1 ? rest : rest.slice(0, i)
    if (!names.has(name)) names.set(name, false)
  }
  return names
}

export const fakeFsPlugin = {
  mkdir: async (path: string): Promise<void> => {
    tauriFsState.dirs.add(path)
  },
  readTextFile: async (path: string): Promise<string> => {
    if (!tauriFsState.files.has(path)) throw new Error(`ENOENT ${path}`)
    return tauriFsState.files.get(path)!
  },
  writeTextFile: async (path: string, content: string): Promise<void> => {
    tauriFsState.files.set(path, content)
  },
  readDir: async (
    dir: string,
  ): Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>> => {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`
    const names = collectReadDirEntries(prefix)
    if (names.size === 0 && !tauriFsState.dirs.has(dir)) throw new Error(`ENOENT ${dir}`)
    return [...names].map(([name, isFile]) => ({ name, isFile, isDirectory: !isFile }))
  },
  exists: async (path: string): Promise<boolean> =>
    tauriFsState.files.has(path) || tauriFsState.dirs.has(path),
  rename: async (from: string, to: string): Promise<void> => {
    if (!tauriFsState.files.has(from)) throw new Error(`ENOENT ${from}`)
    tauriFsState.files.set(to, tauriFsState.files.get(from)!)
    tauriFsState.files.delete(from)
  },
  remove: async (path: string): Promise<void> => {
    if (!tauriFsState.files.has(path)) throw new Error(`ENOENT ${path}`)
    tauriFsState.files.delete(path)
  },
}

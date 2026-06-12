// SPDX-License-Identifier: MIT
// In-memory stand-ins for the Tauri plugins the workspace layer talks to.
// Wire them up in a test with:
//
//   vi.mock('@tauri-apps/plugin-fs', async () => (await import('@/test/fakeTauriFs')).fakeFsPlugin)
//   vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
//   vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)
//   vi.mock('@tauri-apps/plugin-dialog', async () => (await import('@/test/fakeTauriFs')).fakeDialogApi)
//
// The static import and the dynamic imports above resolve to the same module
// instance, so `tauriFsState` reads/asserts the same filesystem the mocks mutate.

const files = new Map<string, string>()
const dirs = new Set<string>()
let dialogResult: string | null = null

export const tauriFsState = {
  files,
  dirs,
  reset(): void {
    files.clear()
    dirs.clear()
    dialogResult = null
  },
  writeFile(path: string, content: string): void {
    files.set(path, content)
  },
  /** What the next dialog `save`/`open` returns (the picked folder path, or null). */
  setDialogResult(path: string | null): void {
    dialogResult = path
  },
}

export const fakePathApi = {
  appDataDir: async (): Promise<string> => '/appdata',
}

export const fakeCoreApi = {
  invoke: async (): Promise<void> => undefined,
}

export const fakeDialogApi = {
  save: async (): Promise<string | null> => dialogResult,
  open: async (): Promise<string | null> => dialogResult,
}

export const fakeFsPlugin = {
  mkdir: async (path: string): Promise<void> => {
    dirs.add(path)
  },
  readTextFile: async (path: string): Promise<string> => {
    if (!files.has(path)) throw new Error(`ENOENT ${path}`)
    return files.get(path)!
  },
  writeTextFile: async (path: string, content: string): Promise<void> => {
    files.set(path, content)
  },
  readDir: async (
    dir: string,
  ): Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>> => {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`
    const names = new Map<string, boolean>()
    for (const p of files.keys()) {
      if (!p.startsWith(prefix)) continue
      const rest = p.slice(prefix.length)
      const i = rest.indexOf('/')
      names.set(i === -1 ? rest : rest.slice(0, i), i === -1)
    }
    for (const d of dirs) {
      if (!d.startsWith(prefix)) continue
      const rest = d.slice(prefix.length)
      if (!rest) continue
      const i = rest.indexOf('/')
      const name = i === -1 ? rest : rest.slice(0, i)
      if (!names.has(name)) names.set(name, false)
    }
    if (names.size === 0 && !dirs.has(dir)) throw new Error(`ENOENT ${dir}`)
    return [...names].map(([name, isFile]) => ({ name, isFile, isDirectory: !isFile }))
  },
  exists: async (path: string): Promise<boolean> => files.has(path) || dirs.has(path),
  rename: async (from: string, to: string): Promise<void> => {
    if (!files.has(from)) throw new Error(`ENOENT ${from}`)
    files.set(to, files.get(from)!)
    files.delete(from)
  },
  remove: async (path: string): Promise<void> => {
    if (!files.has(path)) throw new Error(`ENOENT ${path}`)
    files.delete(path)
  },
}

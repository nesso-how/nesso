// SPDX-License-Identifier: MIT
// In-memory stand-ins for the Tauri plugins the workspace layer talks to.
// Wire them up in a test with:
//
//   vi.mock('@tauri-apps/plugin-fs', async () => (await import('@/test/fakeTauriFs')).fakeFsPlugin)
//   vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)
//   vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)
//
// The static import and the dynamic imports above resolve to the same module
// instance, so `tauriFsState` reads/asserts the same filesystem the mocks mutate.

export {
  tauriFsState,
  grantFsScopeAccept,
  getGrantedPaths,
  seedTrustedPath,
  getTrustedPaths,
} from './state'
export { fakePathApi } from './path'
export { fakeCoreApi } from './core'
export { fakeFsPlugin } from './fs'

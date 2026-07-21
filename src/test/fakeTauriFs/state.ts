// SPDX-License-Identifier: MIT
// In-memory Tauri test double: filesystem, dialog, IPC, path, and command recording.

const files = new Map<string, string>()
const dirs = new Set<string>()
let dialogResult: string | null = null
let saveFileDialogError: string | null = null
let saveFileDialogErrorIsString: boolean = false

/** Records every `invoke` call for test assertions. */
const calls: Array<{ command: string; args?: Record<string, unknown> }> = []

export const tauriFsState = {
  files,
  dirs,
  calls,
  reset(): void {
    files.clear()
    dirs.clear()
    dialogResult = null
    saveFileDialogError = null
    saveFileDialogErrorIsString = false
    calls.length = 0
  },
  writeFile(path: string, content: string): void {
    files.set(path, content)
  },
  setDialogResult(path: string | null): void {
    dialogResult = path
  },
  setSaveFileDialogError(message: string | null): void {
    saveFileDialogError = message
  },
  setSaveFileDialogErrorAsString(value: boolean): void {
    saveFileDialogErrorIsString = value
  },
}

function handleSaveFileDialog(args?: Record<string, unknown>): unknown {
  if (saveFileDialogError !== null) {
    throw saveFileDialogErrorIsString ? saveFileDialogError : new Error(saveFileDialogError)
  }
  if (dialogResult) {
    const contents = args?.contents as string | undefined
    if (contents !== undefined) {
      files.set(dialogResult, contents)
    }
    return dialogResult
  }
  return null
}

export const fakeCoreApi = {
  invoke: async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    calls.push({ command: cmd, args })
    if (cmd === 'pick_workspace_folder') return dialogResult
    if (cmd === 'save_file_dialog') return handleSaveFileDialog(args)
    if (cmd === 'grant_fs_scope') return undefined
    if (cmd === 'set_app_menu') return undefined
    return undefined
  },
}

// ── Path API ─────────────────────────────────────────────────────

export const fakePathApi = {
  appDataDir: async (): Promise<string> => '/appdata',
}

// SPDX-License-Identifier: MIT

import {
  tauriFsState,
  grantFsScopeAccept,
  _getDialogResult,
  _getSaveFileDialogError,
  _getSaveFileDialogErrorIsString,
  seedTrustedPath,
} from './state'

function handlePickWorkspaceFolder(): unknown {
  const result = _getDialogResult()
  if (result) {
    // The real Rust side adds the resolved canonical path to the trust
    // store after validation.  In the fake, we seed it directly so
    // subsequent `grant_fs_scope` calls for descendants pass.
    seedTrustedPath(result)
  }
  return result
}

function handleSaveFileDialog(args?: Record<string, unknown>): unknown {
  const saveFileDialogError = _getSaveFileDialogError()
  const saveFileDialogErrorIsString = _getSaveFileDialogErrorIsString()
  if (saveFileDialogError !== null) {
    if (saveFileDialogErrorIsString) {
      throw saveFileDialogError // throw original string, as real Tauri invoke() does
    }
    throw new Error(saveFileDialogError)
  }
  const dialogResult = _getDialogResult()
  if (dialogResult) {
    const contents = args?.contents as string | undefined
    if (contents !== undefined) {
      tauriFsState.files.set(dialogResult, contents)
    }
    return dialogResult
  }
  return null
}

function handleGrantFsScope(args?: Record<string, unknown>): unknown {
  grantFsScopeAccept(args?.path as string)
  return undefined
}

export const fakeCoreApi = {
  invoke: async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    if (cmd === 'pick_workspace_folder') return handlePickWorkspaceFolder()
    if (cmd === 'save_file_dialog') return handleSaveFileDialog(args)
    if (cmd === 'grant_fs_scope') return handleGrantFsScope(args)
    if (cmd === 'set_app_menu') return undefined
    return undefined
  },
}

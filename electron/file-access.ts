import { constants } from 'node:fs'
import { open, rename, rm, type FileHandle } from 'node:fs/promises'
import path from 'node:path'
import { fileTextLimit, type FileSaveOptions } from '../packages/plugin/src/files.ts'
import { ElectronError } from './errors.ts'

export async function readChosenFile(filename: string, mediaType: string, current: () => boolean) {
  let file: FileHandle | undefined
  try {
    file = await open(filename, constants.O_RDONLY | constants.O_NONBLOCK)
    const stat = await file.stat()
    if (!current() || !stat.isFile() || stat.size > fileTextLimit) throw new ElectronError([{ path: 'files', message: 'File is unavailable or exceeds its budget' }])
    const chunks: Uint8Array[] = []
    let size = 0
    for await (const chunk of file.createReadStream({ autoClose: false, end: fileTextLimit })) {
      size += chunk.byteLength
      if (!current() || size > fileTextLimit) throw new ElectronError([{ path: 'files', message: 'File reading cancelled or limit exceeded' }])
      chunks.push(chunk)
    }
    if (!current()) throw new ElectronError([{ path: 'files', message: 'File reading cancelled' }])
    return { name: path.basename(filename), mediaType, text: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)) }
  } catch { throw new ElectronError([{ path: 'files', message: 'Could not read the chosen text file' }]) }
  finally { await file?.close() }
}

export async function saveChosenFile(filename: string, options: FileSaveOptions, current: () => boolean) {
  if (!current()) return { saved: false }
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`
  try {
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(options.text, 'utf8'); await file.sync() } finally { await file.close() }
    if (!current()) return { saved: false }
    await rename(temporary, filename)
    return { saved: true }
  } catch { throw new ElectronError([{ path: 'files', message: 'Could not save the chosen text file' }]) }
  finally { await rm(temporary, { force: true }).catch(() => {}) }
}

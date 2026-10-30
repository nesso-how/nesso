import type {
  FileOpenOptions,
  FileOpenResult,
  FileSaveOptions,
} from '../packages/plugin/src/files.ts'

export type FileBridge = {
  readonly open: (id: string, options: FileOpenOptions) => Promise<FileOpenResult>
  readonly save: (id: string, options: FileSaveOptions) => Promise<{ saved: boolean }>
  readonly cancel: (id: string) => void
}

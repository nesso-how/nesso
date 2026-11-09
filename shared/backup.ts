import { z } from 'zod'
import { persistenceSections } from './persistence.ts'

export const automaticBackupName =
  /^nesso-backup-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/

export const backupSchema = z.strictObject({
  format: z.literal('nesso-backup'),
  version: z.literal(1),
  createdAt: z.iso.datetime({ precision: 3 }),
  appVersion: z.string().refine((value) => !!value.trim()),
  records: z.record(z.enum(persistenceSections), z.unknown()),
})
export type Backup = z.infer<typeof backupSchema>

export type BackupCandidate = { id: string; createdAt: string }
export type AutomaticBackupState = {
  directory: string
  defaultDirectory: string
  lastBackup?: string
  failed: boolean
  configurationFailed: boolean
}
type Result<T> = { value: T } | { issues: { path: string; message: string }[] }

export type BackupBridge = {
  automaticState: () => Promise<Result<AutomaticBackupState>>
  chooseDirectory: () => Promise<Result<AutomaticBackupState | null>>
  useDefaultDirectory: () => Promise<Result<AutomaticBackupState>>
  openDirectory: () => Promise<Result<null>>
  create: () => Promise<Result<boolean>>
  choose: () => Promise<Result<BackupCandidate | null>>
  restore: (id: string) => Promise<Result<null>>
  cancel: () => void
}

import type { PersistenceSection } from './persistence.ts'

export type Backup = {
  format: 'nesso-backup'
  version: 1
  createdAt: string
  appVersion: string
  records: Record<PersistenceSection, unknown>
}

export type BackupCandidate = { id: string; createdAt: string }
type Result<T> = { value: T } | { issues: { path: string; message: string }[] }

export type BackupBridge = {
  create: () => Promise<Result<boolean>>
  choose: () => Promise<Result<BackupCandidate | null>>
  restore: (id: string) => Promise<Result<null>>
  cancel: () => void
}

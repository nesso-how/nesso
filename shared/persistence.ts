export const persistenceSections = [
  'document',
  'preferences',
  'conversation',
  'plugin-storage',
] as const
export type PersistenceSection = (typeof persistenceSections)[number]
export type PersistenceIssue = {
  section: PersistenceSection
  operation: 'read' | 'write'
  path: string
  message: string
}

export type PersistenceStorage = {
  read: (section: PersistenceSection) => Promise<unknown>
  write: (section: PersistenceSection, value: unknown) => Promise<void>
}

type StorageResult<T> = { value: T } | { issues: { path: string; message: string }[] }

export type PersistenceBridge = {
  read: (section: PersistenceSection) => Promise<StorageResult<unknown>>
  write: (section: PersistenceSection, value: unknown) => Promise<StorageResult<null>>
  beforeClose: (save: () => Promise<boolean>, confirm: () => Promise<boolean>) => () => void
}

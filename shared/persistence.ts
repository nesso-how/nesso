export const persistenceSections = ['document', 'preferences', 'conversation'] as const
export type PersistenceSection = typeof persistenceSections[number]

export type PersistenceStorage = {
  read: (section: PersistenceSection) => Promise<unknown>
  write: (section: PersistenceSection, value: unknown) => Promise<void>
}

type StorageResult<T> = { value: T } | { issues: { path: string; message: string }[] }

export type PersistenceBridge = {
  read: (section: PersistenceSection) => Promise<StorageResult<unknown>>
  write: (section: PersistenceSection, value: unknown) => Promise<StorageResult<null>>
  beforeClose: (save: () => Promise<boolean>) => () => void
}

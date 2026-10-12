export type DataLocationState = {
  directory: string
  defaultDirectory: string
  moving: boolean
  cleanupPending: boolean
}

type Result<T> = { value: T } | { issues: { path: string; message: string }[] }

export type DataLocationBridge = {
  getState: () => Promise<Result<DataLocationState>>
  choose: () => Promise<Result<string | null>>
  validate: (directory: string) => Promise<Result<string>>
  move: (directory: string) => Promise<Result<DataLocationState>>
  open: () => Promise<Result<null>>
  retryCleanup: () => Promise<Result<DataLocationState>>
  subscribe: (listener: (state: DataLocationState) => void) => () => void
  beforeMove: (save: () => Promise<boolean>) => () => void
}

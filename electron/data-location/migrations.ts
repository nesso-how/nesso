import { ElectronError } from '../errors.ts'

const fail = (): never => {
  throw new ElectronError([{ path: 'dataLocation', message: 'storageConfig' }])
}

export function migrateDataLocation(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail()
  if (!Object.hasOwn(value, 'version')) return { config: { ...value, version: 1 }, upgraded: true }
  if ((value as { version: unknown }).version !== 1) return fail()
  return { config: value, upgraded: false }
}

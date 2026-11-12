import { ElectronError } from '../errors.ts'

export function migrateInstalledPlugin(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new ElectronError([{ path: 'plugins', message: 'Invalid installed package record' }])
  const { version, enabled, npmIntegrity, ...saved } = value as Record<string, unknown>
  if (typeof version !== 'number')
    return {
      record: { version: 1, package: { ...saved, version }, enabled, npmIntegrity },
      upgraded: true,
    }
  if (version !== 1)
    throw new ElectronError([
      { path: 'plugins.version', message: 'Unsupported installed package record version' },
    ])
  return { record: value, upgraded: false }
}

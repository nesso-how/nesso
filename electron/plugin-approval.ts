import { randomUUID } from 'node:crypto'
import gt from 'semver/functions/gt.js'
import prerelease from 'semver/functions/prerelease.js'
import { PluginError } from '../packages/plugin/src/errors.ts'
import type { InstalledPlugin, PluginAccess } from '../shared/plugins.ts'

export function createPluginApproval(
  received: InstalledPlugin,
  previous: InstalledPlugin | undefined,
  npm: boolean,
) {
  if (
    previous &&
    (previous.name !== received.name ||
      previous.nesso.kind !== received.nesso.kind ||
      previous.contentId === received.contentId)
  ) {
    throw new PluginError('stale-state', [
      { path: 'plugins', message: 'The installed package identity or kind changed' },
    ])
  }
  if (
    npm &&
    (prerelease(received.version) || (previous && !gt(received.version, previous.version)))
  ) {
    throw new PluginError('invalid-input', [
      { path: 'version', message: 'Choose a newer stable package version' },
    ])
  }
  const baseline: PluginAccess | undefined =
    npm && previous?.npmIntegrity ? previous.nesso : undefined
  const access: PluginAccess = {
    writes: received.nesso.writes.filter((value) => !baseline?.writes.includes(value)),
    capabilities: received.nesso.capabilities.filter(
      (value) => !baseline?.capabilities.includes(value),
    ),
  }
  const routine = !!baseline && !access.writes.length && !access.capabilities.length
  const challenge = routine ? undefined : randomUUID()
  let authorization: 'dialog' | 'existing-access' | undefined = routine
    ? 'existing-access'
    : undefined
  let pending = !routine
  let revoked = false
  return {
    challenge,
    access,
    additional: !!baseline,
    get source() {
      return authorization
    },
    respond: (value: unknown, allow: unknown) => {
      if (revoked || !pending || value !== challenge || typeof allow !== 'boolean') return false
      pending = false
      if (allow) authorization = 'dialog'
      else revoked = true
      return true
    },
    revoke: () => {
      revoked = true
      pending = false
    },
    authorized: (content: InstalledPlugin, installed: InstalledPlugin | undefined) => {
      if (
        revoked ||
        !authorization ||
        content.contentId !== received.contentId ||
        content.name !== received.name ||
        content.nesso.kind !== received.nesso.kind ||
        installed?.contentId !== previous?.contentId
      )
        return false
      if (authorization === 'dialog') return true
      const access: PluginAccess | undefined = installed?.nesso
      return (
        !!installed?.npmIntegrity &&
        installed.name === content.name &&
        installed.nesso.kind === content.nesso.kind &&
        content.nesso.writes.every((value) => access?.writes.includes(value)) &&
        content.nesso.capabilities.every((value) => access?.capabilities.includes(value))
      )
    },
  }
}

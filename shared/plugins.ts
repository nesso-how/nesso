import type { Locale } from '@nesso-how/i18n'
import { z } from 'zod'
import type { PluginPackageInput, PreparedPlugin } from '../packages/plugin/src/package.ts'
import type { PluginManifest } from '../packages/plugin/src/runtime.ts'

export type PluginResult<T> = { readonly value: T } | { readonly issues: readonly { readonly path: string; readonly message: string }[] }
export const npmIntegrity = z.string().regex(/^sha512-[A-Za-z0-9+/]{86}==$/)
export type InstalledPlugin = PreparedPlugin & { readonly enabled: boolean; readonly npmIntegrity?: string }
export type NpmPlugin = Pick<PreparedPlugin, 'name' | 'version' | 'author' | 'repository' | 'nesso' | 'i18n'>
export type PluginAccess = Pick<Extract<PluginManifest, { readonly kind: 'actions' }>, 'writes' | 'capabilities'>
export type PluginApproval = {
  readonly id: string
  readonly challenge: string
  readonly name: string
  readonly version: string
  readonly description: string
  readonly access: PluginAccess
  readonly additional: boolean
  readonly updating: boolean
}
export type PluginBridge = {
  readonly list: () => Promise<PluginResult<{ readonly safeMode: boolean; readonly packages: readonly InstalledPlugin[]; readonly issues: readonly { readonly path: string; readonly message: string }[] }>>
  readonly search: (query: string, offset?: number) => Promise<PluginResult<{ readonly packages: readonly NpmPlugin[]; readonly next?: number }>>
  readonly latest: (name: string) => Promise<PluginResult<NpmPlugin>>
  readonly propose: (id: string, input: PluginPackageInput, locale: Locale, replacing?: string) => Promise<PluginResult<InstalledPlugin | null>>
  readonly installNpm: (id: string, input: { readonly name: string; readonly version: string }, locale: Locale, replacing?: string) => Promise<PluginResult<InstalledPlugin | null>>
  readonly settle: (id: string, contentId: string, valid: boolean) => Promise<PluginResult<null>>
  readonly cancel: (id: string) => void
  readonly approve: (challenge: string, allow: boolean) => Promise<PluginResult<null>>
  readonly remove: (contentId: string) => Promise<PluginResult<null>>
  readonly setEnabled: (contentId: string, enabled: boolean) => Promise<PluginResult<InstalledPlugin>>
  readonly subscribe: (listener: (event: { readonly type: 'install'; readonly id: string; readonly package: InstalledPlugin; readonly replacing?: string } | { readonly type: 'cancel'; readonly id: string } | { readonly type: 'approval'; readonly approval: PluginApproval }) => void, runtime?: boolean) => () => void
}

import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import type { ActionDefinition, Plugin, PluginContext, RendererDefinition, ThemeDefinition, VocabDefinition } from '@nesso/plugin'
import type { Locale } from '@nesso/i18n'

type Expect<T extends true> = T
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false
type Result<K extends Plugin['kind']> = ReturnType<Extract<Plugin, { readonly kind: K }>['create']>
type Accepts<K, T> = {
  readonly kind: K
  readonly metadata: Plugin['metadata']
  readonly operations: readonly []
  readonly create: (context: PluginContext) => T
} extends Plugin ? true : false

export type PluginContract = [
  Expect<Equal<Plugin['kind'], 'renderer' | 'theme' | 'vocab' | 'actions'>>,
  Expect<Equal<Result<'renderer'>, RendererDefinition>>,
  Expect<Equal<Result<'theme'>, ThemeDefinition>>,
  Expect<Equal<Result<'vocab'>, VocabDefinition>>,
  Expect<Equal<Result<'actions'>, readonly ActionDefinition[]>>,
  Expect<Equal<Parameters<Plugin['metadata']>, [Locale]>>,
  Expect<Equal<ReturnType<Plugin['metadata']>, {
    readonly name: string
    readonly description: string
    readonly documentation: string
  }>>,
  Expect<Equal<Omit<Plugin, 'metadata'> extends Plugin ? true : false, false>>,
  Expect<Equal<Accepts<'renderer', RendererDefinition>, true>>,
  Expect<Equal<Accepts<'theme', ThemeDefinition>, true>>,
  Expect<Equal<Accepts<'vocab', VocabDefinition>, true>>,
  Expect<Equal<Accepts<'actions', readonly ActionDefinition[]>, true>>,
  Expect<Equal<Accepts<'renderer', readonly RendererDefinition[]>, false>>,
  Expect<Equal<Accepts<'theme', readonly ThemeDefinition[]>, false>>,
  Expect<Equal<Accepts<'vocab', readonly VocabDefinition[]>, false>>,
  Expect<Equal<Accepts<'renderer', {
    readonly renderers: readonly RendererDefinition[]
    readonly actions: readonly ActionDefinition[]
  }>, false>>,
  Expect<Equal<Accepts<'actions', {
    readonly themes: readonly ThemeDefinition[]
    readonly actions: readonly ActionDefinition[]
  }>, false>>,
  Expect<Equal<Omit<Plugin, 'kind'> extends Plugin ? true : false, false>>,
]

test('plugins require localized metadata and exclusive contribution kinds', () => {
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
    '--ignoreConfig', '--noEmit', '--strict', '--skipLibCheck', '--types', 'node',
    '--module', 'preserve', '--moduleResolution', 'bundler', '--allowImportingTsExtensions',
    fileURLToPath(import.meta.url),
  ], { stdio: 'inherit' })
})

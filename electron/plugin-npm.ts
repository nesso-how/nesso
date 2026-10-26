import { Agent } from 'node:https'
import type { ClientRequest, RequestOptions } from 'node:http'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { once } from 'node:events'
import { createGunzip } from 'node:zlib'
import registryFetch from 'npm-registry-fetch'
import { Parser, type ReadEntry } from 'tar'
import { z } from 'zod'
import { packageLimits, parsePackageIdentity, preparePluginPackage } from '../packages/plugin/src/package.ts'
import { parsePluginI18n, parsePluginManifest, PluginError } from '../packages/plugin/src/runtime.ts'
import prerelease from 'semver/functions/prerelease.js'
import { ElectronError } from './errors.ts'
import { npmIntegrity } from '../shared/plugins.ts'
import type { NpmPlugin } from '../shared/plugins.ts'

const registry = 'https://registry.npmjs.org'
const limits = { metadata: 64 * 1024, compressed: 32 * 1024 * 1024, expanded: 128 * 1024 * 1024, files: 1024, deadline: 60_000 }
type RegistryRequest = (url: string, options: registryFetch.Options & { signal: AbortSignal }) => ReturnType<typeof registryFetch>
const failure = () => new ElectronError([{ path: 'npm', message: 'Could not download or validate the package. Check the connection and package compatibility, then retry.' }])
const trustedUrl = (value: string) => {
  const url = new URL(value)
  if (url.origin !== registry || url.username || url.password || url.hash) throw failure()
  return url
}

async function download(url: string, limit: number, signal: AbortSignal, request: RegistryRequest, integrity?: string) {
  trustedUrl(url)
  const agent = new Agent({ keepAlive: false }) as Agent & { addRequest: (request: ClientRequest, options: RequestOptions) => void }
  const addRequest = agent.addRequest.bind(agent)
  let requests = 0
  let transferred = 0
  let rejected = false
  const reject = (outgoing: ClientRequest) => { rejected = true; setImmediate(() => outgoing.destroy(failure())) }
  agent.addRequest = (outgoing, options) => {
    if (rejected || ++requests > 6 || options.protocol !== 'https:' || options.hostname !== 'registry.npmjs.org' || Number(options.port || 443) !== 443 || options.auth) throw failure()
    outgoing.prependOnceListener('response', (response) => {
      response.on('error', () => {})
      const length = response.headers['content-length']
      if ((response.statusCode !== 200 && ![301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) || (length !== undefined && (!/^\d+$/.test(length) || Number(length) > limit)) || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) reject(outgoing)
      response.on('data', (chunk: Buffer) => { transferred += chunk.length; if (transferred > limit && !rejected) reject(outgoing) })
    })
    addRequest(outgoing, options)
  }
  try {
    signal.throwIfAborted()
    const response = await request(url, { agent, registry, signal, integrity, strictSSL: true, fetchRetries: 0, timeout: limits.deadline, headers: { 'accept-encoding': 'identity', 'cache-control': 'no-store' } })
    response.body.on('error', () => {})
    if (response.status !== 200 || rejected) throw failure()
    trustedUrl(response.url)
    const chunks: Buffer[] = []
    let size = 0
    await pipeline(response.body, new Writable({ write(chunk: Buffer, _encoding, done) {
      size += chunk.length
      if (size > limit) { done(failure()); return }
      chunks.push(chunk)
      done()
    } }), { signal })
    signal.throwIfAborted()
    return Buffer.concat(chunks, size)
  } finally { agent.destroy() }
}

const json = async (url: string, limit: number, signal: AbortSignal, request: RegistryRequest) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await download(url, limit, signal, request)))

export async function latestNpmPlugin(name: unknown, cancellation: AbortSignal, request: RegistryRequest = registryFetch): Promise<NpmPlugin> {
  const identity = parsePackageIdentity({ name, version: '0.0.0' })
  const signal = AbortSignal.any([cancellation, AbortSignal.timeout(limits.deadline)])
  const metadata = await json(`${registry}/${encodeURIComponent(identity.name)}/latest`, limits.metadata, signal, request)
  try {
    const received = parsePackageIdentity(metadata)
    if (received.name !== identity.name || prerelease(received.version)) throw failure()
    return { name: received.name, version: received.version, author: received.author, repository: received.repository, nesso: parsePluginManifest(received.nesso), i18n: parsePluginI18n(received.i18n) }
  } catch {
    throw new PluginError('invalid-input', [{ path: 'npm', message: 'The latest version is not a compatible stable Nesso plugin.' }])
  }
}

export async function searchNpmPlugins(input: unknown, cancellation: AbortSignal, request: RegistryRequest = registryFetch) {
  const { query, offset } = z.object({ query: z.string().trim().max(128), offset: z.number().int().min(0).max(10_000).default(0) }).parse(input)
  const signal = AbortSignal.any([cancellation, AbortSignal.timeout(limits.deadline)])
  try {
    const params = new URLSearchParams({ text: 'keywords:nesso-plugin', size: '10', from: String(offset) })
    const result = z.object({ objects: z.array(z.object({ package: z.object({ name: z.string().max(214), keywords: z.array(z.string()).optional() }) })).max(10), total: z.number().int().nonnegative() }).parse(await json(`${registry}/-/v1/search?${params}`, 512 * 1024, signal, request))
    const packages: NpmPlugin[] = []
    for (const { package: entry } of result.objects) {
      signal.throwIfAborted()
      if (!entry.keywords?.includes('nesso-plugin')) continue
      let plugin: NpmPlugin
      try { plugin = await latestNpmPlugin(entry.name, signal, request) }
      catch (error) { signal.throwIfAborted(); if (error instanceof PluginError) continue; throw error }
      const names = [plugin.name, ...Object.values(plugin.i18n.metadata.name)].join(' ').toLowerCase()
      if (names.includes(query.toLowerCase())) packages.push(plugin)
    }
    const next = offset + result.objects.length
    return { packages, ...(result.objects.length && next < result.total && next <= 10_000 ? { next } : {}) }
  } catch {
    throw new ElectronError([{ path: 'npm', message: 'Could not search npm. Check the connection and try again; installed plugins remain available offline.' }])
  }
}

async function readArchive(bytes: Buffer, signal: AbortSignal) {
  const files = new Map<string, Buffer>()
  const paths = new Set<string>()
  let expanded = 0
  let admitted = 0
  let entries = 0
  let eof = false
  let error: unknown
  const parser = new Parser({ strict: true, maxMetaEntrySize: limits.metadata, zstd: false, brotli: false })
  parser.on('error', (cause: unknown) => { error = cause })
  parser.on('eof', () => { eof = true })
  parser.on('ignoredEntry', () => { error = failure() })
  parser.on('entry', (entry: ReadEntry) => {
    const directory = entry.type === 'Directory'
    const path = directory && entry.path.endsWith('/') ? entry.path.slice(0, -1) : entry.path
    const invalidPath = Buffer.byteLength(path) > 240 || (path !== 'package' && !path.startsWith('package/')) || (path === 'package' && !directory)
      || /[\\%:?#]/.test(path) || /\\/.test(entry.header.path ?? '')
      || [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      || path.split('/').some((part) => !part || part === '.' || part === '..')
    admitted += entry.size
    if (++entries > limits.files || admitted > limits.expanded || invalidPath || paths.has(path) || (!directory && entry.type !== 'File' && entry.type !== 'OldFile') || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > (path === 'package/package.json' ? limits.metadata : packageLimits.entry) || (directory && entry.size !== 0)) {
      error = failure()
      entry.resume()
      return
    }
    paths.add(path)
    const chunks: Buffer[] = []
    entry.on('data', (chunk: Buffer) => { if (!directory) chunks.push(chunk) })
    entry.on('end', () => { if (!directory) files.set(path.slice('package/'.length), Buffer.concat(chunks)) })
    entry.resume()
  })
  const completed = once(parser, 'end')
  void completed.catch(() => {})
  try {
    await pipeline(Readable.from([bytes]), createGunzip(), async (source) => {
      for await (const chunk of source) {
        expanded += chunk.length
        if (expanded > limits.expanded || error) throw failure()
        if (expanded === chunk.length && chunk[0] === 0x1f) throw failure()
        const writable = eof || parser.write(chunk)
        if (!writable && !eof) await Promise.race([once(parser, 'drain'), completed])
        if (error) throw failure()
      }
      parser.end()
      await completed
      if (error || !eof) throw failure()
    }, { signal })
    return files
  } catch (cause) { parser.abort(failure()); throw cause }
}

export async function acquireNpmPlugin(input: unknown, cancellation: AbortSignal, request: RegistryRequest = registryFetch) {
  const signal = AbortSignal.any([cancellation, AbortSignal.timeout(limits.deadline)])
  try {
    const { name, version } = parsePackageIdentity(input)
    const metadata = await json(`${registry}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, limits.metadata, signal, request)
    const identity = parsePackageIdentity(metadata)
    if (identity.name !== name || identity.version !== version) throw failure()
    const dist = z.object({ tarball: z.string().max(2048), integrity: npmIntegrity }).parse(metadata.dist)
    const archive = await download(trustedUrl(dist.tarball).href, limits.compressed, signal, request, dist.integrity)
    const files = await readArchive(archive, signal)
    const bytes = files.get('package.json')
    if (!bytes) throw failure()
    const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const received = parsePackageIdentity(manifest)
    if (received.name !== name || received.version !== version) throw failure()
    const nesso = parsePluginManifest(received.nesso)
    const entry = files.get(nesso.entry)
    if (!entry) throw failure()
    const fonts = nesso.kind === 'theme' ? [...files].filter(([path]) => path.endsWith('.woff2')).map(([path, bytes]) => ({ path, bytes })) : []
    const prepared = await preparePluginPackage({ manifest, files: [{ path: nesso.entry, bytes: entry }, ...fonts] })
    signal.throwIfAborted()
    return { ...prepared, npmIntegrity: dist.integrity }
  } catch { throw failure() }
}

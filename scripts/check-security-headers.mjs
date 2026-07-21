// SPDX-License-Identifier: MIT

/**
 * Validates Vercel security header configurations.
 * Usage: node scripts/check-security-headers.mjs
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// -- constants --
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const FILES = ['vercel.json', 'docs/vercel.json']
const REQUIRED_HEADERS = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
]
const LOOPBACK_HOSTS = ['http://localhost', 'http://127.0.0.1', 'http://[::1]']

const COMMON_CSP = [
  { d: 'default-src', inc: ["'self'"] },
  { d: 'object-src', inc: ["'none'"] },
  { d: 'frame-ancestors', inc: ["'none'"] },
  { d: 'worker-src', inc: ["'self'", 'blob:'] },
]

const APP_CSP = [
  { d: 'script-src', inc: ["'wasm-unsafe-eval'"] },
  { d: 'style-src', inc: ['https://fonts.googleapis.com'] },
  { d: 'font-src', inc: ['https://fonts.gstatic.com'] },
  { d: 'connect-src', excl: ['http:'] },
  { d: 'connect-src', inc: ['http://localhost:*'] },
  { d: 'connect-src', inc: ['http://127.0.0.1:*'] },
  { d: 'connect-src', inc: ['http://[::1]:*'] },
  { d: 'connect-src', inc: ['https:'] },
]

const DOCS_CSP = [
  { d: 'script-src', inc: ["'unsafe-inline'"] },
  { d: 'style-src', inc: ['https://fonts.googleapis.com'] },
  { d: 'font-src', inc: ['https://fonts.gstatic.com'] },
  { d: 'connect-src', excl: ['http:'] },
]

// -- CSP parser --
function parseCSP(value) {
  const map = new Map()
  for (const token of value.split(';')) {
    const t = token.trim()
    if (!t) continue
    const si = t.indexOf(' ')
    if (si === -1) {
      map.set(t.toLowerCase(), [])
    } else {
      const name = t.slice(0, si).toLowerCase()
      const sources = t
        .slice(si + 1)
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => (s.startsWith("'") && s.endsWith("'") ? s : s.toLowerCase()))
      map.set(name, sources)
    }
  }
  return map
}

// -- source matching helpers --
function isWildcardPort(src, req) {
  const host = req.slice(0, -2)
  if (src === host) return true
  return src.startsWith(host) && /^:\d+$/.test(src.slice(host.length))
}

function isLoopbackHost(src, req) {
  if (!src.startsWith(req)) return false
  const suffix = src.slice(req.length)
  return suffix === '' || /^:\d+$/.test(suffix)
}

function isOriginMatch(src, req) {
  if (!src.startsWith(req)) return false
  const suffix = src.slice(req.length)
  return suffix === '' || suffix.startsWith('/') || suffix.startsWith('?')
}

function matches(src, req) {
  src = src.toLowerCase()
  req = req.toLowerCase()
  if (src === req) return true
  if (req.endsWith(':') && !req.includes('://')) return src.startsWith(req)
  if (req.endsWith(':*')) return isWildcardPort(src, req)
  if (LOOPBACK_HOSTS.includes(req)) return isLoopbackHost(src, req)
  if (req.includes('://')) return isOriginMatch(src, req)
  return src.startsWith(req)
}

// -- HTTP source audit (app: only loopback) --
function auditAppHttp(sources, path) {
  const errors = []
  for (const src of sources) {
    const s = src.toLowerCase()
    if (!s.startsWith('http://')) continue
    const ok = LOOPBACK_HOSTS.some((host) => matches(s, host) || matches(s, `${host}:*`))
    if (!ok) errors.push(`${path}: CSP connect-src forbids non-loopback HTTP source "${src}"`)
  }
  return errors
}

// -- HTTP source audit (docs: no HTTP at all) --
function auditDocsHttp(sources, path) {
  const errors = []
  for (const src of sources) {
    if (src.toLowerCase().startsWith('http://'))
      errors.push(`${path}: CSP connect-src forbids HTTP source "${src}"`)
  }
  return errors
}

// -- validation helpers --
function findCatchAllRoute(config) {
  const routes = Array.isArray(config.headers) ? config.headers : []
  return routes.find((r) => r.source === '/(.*)')
}

function checkRequiredHeaders(headers, path) {
  const errors = []
  for (const h of REQUIRED_HEADERS) {
    const found = headers.some(
      (x) => x?.key === h && typeof x.value === 'string' && x.value.trim().length > 0,
    )
    if (!found) errors.push(`${path}: missing required header "${h}"`)
  }
  return errors
}

function checkCspRules(csp, rules, path) {
  const errors = []
  for (const rule of rules) {
    const sources = csp.get(rule.d)
    if (!sources) {
      errors.push(`${path}: CSP missing directive "${rule.d}"`)
      continue
    }
    for (const req of rule.inc || []) {
      if (!sources.some((s) => matches(s, req)))
        errors.push(`${path}: CSP "${rule.d}" must include "${req}"`)
    }
    for (const forbid of rule.excl || []) {
      if (sources.includes(forbid))
        errors.push(`${path}: CSP "${rule.d}" must NOT contain "${forbid}"`)
    }
  }
  return errors
}

// -- main validator (single export) --
export function validateConfig(config, configPath) {
  const route = findCatchAllRoute(config)
  if (!route) return [`${configPath}: missing /(.*) header route`]

  const headers = Array.isArray(route.headers) ? route.headers : []
  const errors = checkRequiredHeaders(headers, configPath)

  const cspHeader = headers.find((x) => x?.key === 'Content-Security-Policy')
  if (!cspHeader) return errors

  const csp = parseCSP(cspHeader.value)

  errors.push(...checkCspRules(csp, COMMON_CSP, configPath))

  const rules = configPath === 'vercel.json' ? APP_CSP : DOCS_CSP
  errors.push(...checkCspRules(csp, rules, configPath))

  const connectSrc = csp.get('connect-src') ?? []
  if (configPath === 'vercel.json') {
    errors.push(...auditAppHttp(connectSrc, configPath))
  } else {
    errors.push(...auditDocsHttp(connectSrc, configPath))
  }

  return errors
}

// -- CLI --
function main() {
  let exitCode = 0
  for (const path of FILES) {
    const config = JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'))
    const errors = validateConfig(config, path)
    for (const err of errors) console.error(err)
    if (errors.length > 0) exitCode = 1
  }
  if (exitCode === 0) console.log(`Security headers OK: ${FILES.join(', ')}`)
  process.exit(exitCode)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) main()

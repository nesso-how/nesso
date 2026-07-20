// SPDX-License-Identifier: MIT

/**
 * Verifies both Vercel configuration files define the required security
 * response headers on the `/(.*)` route and that CSP directive values meet
 * the project's security policy.
 *
 * Usage: node scripts/check-security-headers.mjs
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const files = ['vercel.json', 'docs/vercel.json']
export const requiredHeaders = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
]

/**
 * Critical CSP directives that must exist in every config.
 * Each entry: { directive, mustInclude (array of required source tokens) }
 */
export const COMMON_DIRECTIVES = [
  { directive: 'default-src', mustInclude: ["'self'"] },
  { directive: 'object-src', mustInclude: ["'none'"] },
  { directive: 'frame-ancestors', mustInclude: ["'none'"] },
  { directive: 'worker-src', mustInclude: ["'self'", 'blob:'] },
]

/**
 * App CSP requirements:
 * - Google Fonts must be allowed for style and font loading.
 * - connect-src must NOT allow arbitrary cleartext HTTP; only loopback hosts
 *   for local Ollama are permitted.
 * - script-src must include wasm-unsafe-eval for WebAssembly support.
 */
export const APP_CSP_RULES = [
  {
    description: 'script-src allows WebAssembly execution',
    directive: 'script-src',
    mustContain: ["'wasm-unsafe-eval'"],
  },
  {
    description: 'style-src allows Google Fonts stylesheets',
    directive: 'style-src',
    mustContain: ['https://fonts.googleapis.com'],
  },
  {
    description: 'font-src allows Google Fonts files',
    directive: 'font-src',
    mustContain: ['https://fonts.gstatic.com'],
  },
  {
    description: 'connect-src forbids arbitrary http: scheme source',
    directive: 'connect-src',
    mustNotContain: ['http:'],
  },
  {
    description: 'connect-src allows loopback HTTP on any port (localhost)',
    directive: 'connect-src',
    mustContain: ['http://localhost:*'],
  },
  {
    description: 'connect-src allows loopback HTTP on any port (127.0.0.1)',
    directive: 'connect-src',
    mustContain: ['http://127.0.0.1:*'],
  },
  {
    description: 'connect-src allows loopback HTTP on any port (IPv6)',
    directive: 'connect-src',
    mustContain: ['http://[::1]:*'],
  },
  {
    description: 'connect-src allows HTTPS for remote AI endpoints',
    directive: 'connect-src',
    mustContain: ['https:'],
  },
]

/**
 * Docs CSP requirements:
 * - Google Fonts must be allowed for style and font loading.
 * - connect-src must be locked down (no arbitrary scheme sources).
 * - script-src must allow unsafe-inline for Astro/Starlight inline scripts.
 */
export const DOCS_CSP_RULES = [
  {
    description: 'script-src allows inline scripts for Astro/Starlight hydration',
    directive: 'script-src',
    mustContain: ["'unsafe-inline'"],
  },
  {
    description: 'style-src allows Google Fonts stylesheets',
    directive: 'style-src',
    mustContain: ['https://fonts.googleapis.com'],
  },
  {
    description: 'font-src allows Google Fonts files',
    directive: 'font-src',
    mustContain: ['https://fonts.gstatic.com'],
  },
  {
    description: 'connect-src forbids arbitrary http: scheme source',
    directive: 'connect-src',
    mustNotContain: ['http:'],
  },
]

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Parse a CSP header value into a map of directive → array of sources.
 * Directive names and source tokens are normalized to lowercase per the
 * CSP spec (case-insensitive matching), except quoted keyword tokens like
 * 'self', 'none', 'unsafe-inline', and 'wasm-unsafe-eval' which are
 * preserved verbatim for exact comparison against the rule constants.
 */
export function parseCSP(cspValue) {
  /** @type {Map<string, string[]>} */
  const directives = new Map()
  for (const token of cspValue.split(';')) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx === -1) {
      directives.set(trimmed.toLowerCase(), [])
    } else {
      const name = trimmed.slice(0, spaceIdx).toLowerCase()
      const sources = trimmed
        .slice(spaceIdx + 1)
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => {
          // Preserve case of quoted keyword tokens (e.g. 'self', 'none',
          // 'unsafe-inline', 'wasm-unsafe-eval') so they match the rule
          // constants verbatim.  Lowercase everything else (URLs, schemes,
          // host-sources, blob:, data:, etc.).
          if (s.startsWith("'") && s.endsWith("'")) return s
          return s.toLowerCase()
        })
      directives.set(name, sources)
    }
  }
  return directives
}

// ---------------------------------------------------------------------------
// CSP source matching helpers
// ---------------------------------------------------------------------------

/** @param {string} token @returns {boolean} */
function isSchemeOnlyToken(token) {
  return token.endsWith(':') && token.indexOf('://') === -1
}

/** @param {string} source @param {string} required @returns {boolean} */
function matchesSchemeOnly(source, required) {
  return source.startsWith(required)
}

/** @param {string} token @returns {boolean} */
function isWildcardPortToken(token) {
  return token.endsWith(':*')
}

/** @param {string} source @param {string} required @returns {boolean} */
function matchesWildcardPort(source, required) {
  const hostOnly = required.slice(0, -2)
  if (source === hostOnly) return true
  if (!source.startsWith(hostOnly)) return false
  const suffix = source.slice(hostOnly.length)
  return /^:\d+$/.test(suffix)
}

/** @param {string} token @returns {boolean} */
function isLoopbackHostToken(token) {
  return (
    token.startsWith('http://localhost') ||
    token.startsWith('http://127.0.0.1') ||
    token.startsWith('http://[::1]')
  )
}

/** @param {string} source @param {string} required @returns {boolean} */
function matchesLoopbackHost(source, required) {
  if (!source.startsWith(required)) return false
  const suffix = source.slice(required.length)
  return suffix === '' || /^:\d+$/.test(suffix)
}

/** @param {string} token @returns {boolean} */
function isOriginToken(token) {
  return token.includes('://')
}

/** @param {string} source @param {string} required @returns {boolean} */
function matchesOriginBoundary(source, required) {
  if (!source.startsWith(required)) return false
  const suffix = source.slice(required.length)
  return suffix === '' || suffix.startsWith('/') || suffix.startsWith('?')
}

// ---------------------------------------------------------------------------

/**
 * Check whether a source token matches a required token.
 *
 * Rules:
 * - Exact match always passes.
 * - Scheme-only tokens ending in `:` match any source with that scheme prefix
 *   (e.g. `https:` matches `https://any.host/v1`).
 * - For loopback HTTP host tokens (`http://localhost`, `http://127.0.0.1`,
 *   `http://[::1]`), the source must be an exact match OR the host followed by
 *   `:PORT` (digits only). `startsWith` is NOT used — that would allow
 *   lookalikes like `http://localhost.evil`.
 *
 * @param {string} source - the actual source token from the CSP directive
 * @param {string} required - the required token from the rule
 * @returns {boolean}
 */
export function sourceMatchesRequired(source, required) {
  // Normalize to lowercase for case-insensitive CSP matching.
  // Quoted keywords ('self', 'none', etc.) preserve their original
  // casing and are matched verbatim after the first early-return check.
  const src = source.toLowerCase()
  const req = required.toLowerCase()

  if (src === req) return true

  if (isSchemeOnlyToken(req)) return matchesSchemeOnly(src, req)

  if (isWildcardPortToken(req)) return matchesWildcardPort(src, req)

  if (isLoopbackHostToken(req)) return matchesLoopbackHost(src, req)

  if (isOriginToken(req)) return matchesOriginBoundary(src, req)

  // Everything else: prefix match (bare tokens, blob:, data:, etc.)
  return src.startsWith(req)
}

/**
 * Format a description suffix for error messages.
 * @param {string|undefined} description
 * @returns {string}
 */
function formatDesc(description) {
  return description ? ` — ${description}` : ''
}

/**
 * Validate a single CSP rule against the parsed CSP.
 * @param {Map<string, string[]>} csp
 * @param {{ directive: string, mustContain?: string[], mustNotContain?: string[], description?: string }} rule
 * @param {string} configPath
 * @returns {string[]}
 */
function validateSingleRule(csp, rule, configPath) {
  const errors = []
  const sources = csp.get(rule.directive)
  if (!sources) {
    errors.push(`${configPath}: CSP missing directive "${rule.directive}"`)
    return errors
  }

  if (rule.mustContain) {
    for (const required of rule.mustContain) {
      if (!sources.some((s) => sourceMatchesRequired(s, required))) {
        errors.push(
          `${configPath}: CSP "${rule.directive}" must contain "${required}"${formatDesc(rule.description)}`,
        )
      }
    }
  }

  if (rule.mustNotContain) {
    for (const forbidden of rule.mustNotContain) {
      if (sources.includes(forbidden)) {
        errors.push(
          `${configPath}: CSP "${rule.directive}" must NOT contain "${forbidden}"${formatDesc(rule.description)}`,
        )
      }
    }
  }

  return errors
}

/**
 * Validate a parsed CSP against a set of rules. Returns an array of error
 * messages (empty = all passed).
 *
 * @param {Map<string, string[]>} csp
 * @param {Array<{ directive: string, mustContain?: string[], mustNotContain?: string[], description?: string }>} rules
 * @param {string} configPath - used in error messages
 * @returns {string[]}
 */
export function validateDirectives(csp, rules, configPath) {
  return rules.flatMap((rule) => validateSingleRule(csp, rule, configPath))
}

/**
 * Allowed loopback host URIs (scheme + host, no port suffix) used by the
 * explicit-HTTP-source audit.
 */
const LOOPBACK_HOSTS = ['http://localhost', 'http://127.0.0.1', 'http://[::1]']

/**
 * Validate that every explicit HTTP source in `connect-src` is a known
 * loopback host (exact, `:*`, or `:PORT` with digits only).  Returns an array
 * of error messages — empty means all sources are clean.
 *
 * @param {string[]} sources - `connect-src` source tokens
 * @param {string} configPath
 * @returns {string[]}
 */
export function validateConnectSrcHttpSources(sources, configPath) {
  const errors = []
  for (const source of sources) {
    const normalized = source.toLowerCase()
    if (!normalized.startsWith('http://')) continue

    const isLoopback = LOOPBACK_HOSTS.some((host) => {
      if (normalized === host) return true
      if (!normalized.startsWith(host)) return false
      const suffix = normalized.slice(host.length)
      // `:*` (CSP wildcard port) or `:DIGITS`
      return suffix === ':*' || /^:\d+$/.test(suffix)
    })

    if (!isLoopback) {
      errors.push(`${configPath}: CSP connect-src forbids non-loopback HTTP source "${source}"`)
    }
  }
  return errors
}

/**
 * Validate that the docs `connect-src` directive contains NO explicit HTTP
 * sources (not even loopback).  Docs have no AI endpoint connectivity
 * requirement, so any http:// source is a policy violation.
 *
 * @param {string[]} sources - `connect-src` source tokens
 * @param {string} configPath
 * @returns {string[]}
 */
export function validateDocsNoHttpSources(sources, configPath) {
  const errors = []
  for (const source of sources) {
    if (source.toLowerCase().startsWith('http://')) {
      errors.push(`${configPath}: CSP connect-src forbids HTTP source "${source}"`)
    }
  }
  return errors
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

/**
 * Find the `/(.*)` catch-all route. Logs and returns null if missing.
 * @param {Array<{ source: string, headers?: Array<{ key: string, value: string }> }>} routes
 * @param {string} relativePath
 * @returns {{ source: string, headers?: Array<{ key: string, value: string }> } | null}
 */
function findCatchAllRoute(routes, relativePath) {
  const route = routes.find((r) => r.source === '/(.*)')
  if (!route) {
    console.error(`${relativePath}: missing /(.*) header route`)
  }
  return route ?? null
}

/**
 * Check that all required headers are present with non-empty values.
 * Logs any missing headers. Returns `true` if errors were found.
 * @param {Array<{ key: string, value: string }>} headers
 * @param {string} relativePath
 * @returns {boolean}
 */
function checkRequiredHeaders(headers, relativePath) {
  const missing = requiredHeaders.filter(
    (key) =>
      !headers.some(
        (h) => h?.key === key && typeof h.value === 'string' && h.value.trim().length > 0,
      ),
  )

  if (missing.length > 0) {
    console.error(`${relativePath}: missing required headers: ${missing.join(', ')}`)
    return true
  }
  return false
}

/**
 * Check COMMON_DIRECTIVES against the parsed CSP. Logs errors and returns
 * `true` if any directive is missing or a required source is absent.
 * Uses case-insensitive matching so quoted keywords like 'SELF' are accepted.
 * @param {Map<string, string[]>} csp
 * @param {string} relativePath
 * @returns {boolean}
 */
function checkCommonCSPDirectives(csp, relativePath) {
  const errors = validateDirectives(csp, COMMON_DIRECTIVES, relativePath)
  for (const err of errors) {
    console.error(err)
  }
  return errors.length > 0
}

/**
 * Run config-specific CSP rules and common directive checks against the
 * parsed CSP for a single config file.
 * @param {Map<string, string[]>} csp
 * @param {string} relativePath
 * @returns {boolean}
 */
function checkCSPForConfig(csp, relativePath) {
  let hasErrors = checkCommonCSPDirectives(csp, relativePath)

  const rules = relativePath === 'vercel.json' ? APP_CSP_RULES : DOCS_CSP_RULES
  const errors = validateDirectives(csp, rules, relativePath)
  for (const err of errors) {
    console.error(err)
    hasErrors = true
  }

  // App connect-src: audit every explicit HTTP source against the loopback
  // allowlist (catch localhost.evil, non-loopback IPs, etc.).
  if (relativePath === 'vercel.json') {
    const connectSrc = csp.get('connect-src') ?? []
    const httpErrors = validateConnectSrcHttpSources(connectSrc, relativePath)
    for (const err of httpErrors) {
      console.error(err)
      hasErrors = true
    }
  }

  // Docs connect-src: reject ALL explicit HTTP sources (docs have no AI
  // endpoint connectivity requirement).
  if (relativePath === 'docs/vercel.json') {
    const connectSrc = csp.get('connect-src') ?? []
    const docHttpErrors = validateDocsNoHttpSources(connectSrc, relativePath)
    for (const err of docHttpErrors) {
      console.error(err)
      hasErrors = true
    }
  }

  return hasErrors
}

/**
 * Process a single Vercel config file. Logs errors to stderr.
 * @param {string} relativePath - path relative to repo root
 * @returns {boolean} true if errors were found
 */
function processConfigFile(relativePath) {
  const config = JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'))
  const routes = Array.isArray(config.headers) ? config.headers : []

  const catchAllRoute = findCatchAllRoute(routes, relativePath)
  if (!catchAllRoute) return true

  const headers = Array.isArray(catchAllRoute.headers) ? catchAllRoute.headers : []

  let hasErrors = checkRequiredHeaders(headers, relativePath)

  const cspHeader = headers.find((h) => h?.key === 'Content-Security-Policy')
  if (!cspHeader) return hasErrors // already reported as missing above

  if (checkCSPForConfig(parseCSP(cspHeader.value), relativePath)) {
    hasErrors = true
  }
  return hasErrors
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  let exitCode = 0

  for (const relativePath of files) {
    if (processConfigFile(relativePath)) {
      exitCode = 1
    }
  }

  if (exitCode === 0) {
    console.log(`Security headers OK: ${files.join(', ')}`)
  }
  process.exit(exitCode)
}

// Run CLI only when executed directly (not imported)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  main()
}

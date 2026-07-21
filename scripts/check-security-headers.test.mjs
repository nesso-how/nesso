// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { validateConfig } from './check-security-headers.mjs'

// --- valid CSP fixtures ---
const APP_CSP =
  "default-src 'self'; object-src 'none'; frame-ancestors 'none'; " +
  "worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'; " +
  "style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://[::1]:*"

const DOCS_CSP =
  "default-src 'self'; object-src 'none'; frame-ancestors 'none'; " +
  "worker-src 'self' blob:; script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
  "connect-src 'self'"

const SEC_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

function app(csp) {
  return {
    headers: [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: csp ?? APP_CSP }, ...SEC_HEADERS],
      },
    ],
  }
}

function docs(csp) {
  return {
    headers: [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: csp ?? DOCS_CSP }, ...SEC_HEADERS],
      },
    ],
  }
}

// --- test suite ---
describe('validateConfig', () => {
  // -- positive --
  it('accepts valid app config', () => {
    expect(validateConfig(app(), 'vercel.json')).toEqual([])
  })

  it('accepts valid docs config', () => {
    expect(validateConfig(docs(), 'docs/vercel.json')).toEqual([])
  })

  // -- route --
  it('rejects missing /(.*) route', () => {
    expect(validateConfig({ headers: [] }, 'vercel.json')).toContainEqual(
      expect.stringContaining('missing /(.*) header route'),
    )
  })

  // -- required headers --
  it('rejects missing required header', () => {
    const c = app()
    c.headers[0].headers = c.headers[0].headers.filter((h) => h.key !== 'X-Content-Type-Options')
    expect(validateConfig(c, 'vercel.json')).toContainEqual(
      expect.stringContaining('missing required header "X-Content-Type-Options"'),
    )
  })

  it('rejects missing CSP header', () => {
    const c = app()
    c.headers[0].headers = c.headers[0].headers.filter((h) => h.key !== 'Content-Security-Policy')
    const r = validateConfig(c, 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('missing required header "Content-Security-Policy"'),
    )
  })

  // -- CSP structure --
  it('rejects empty CSP value', () => {
    expect(validateConfig(app(' '), 'vercel.json')).toContainEqual(
      expect.stringContaining('CSP missing directive "default-src"'),
    )
  })

  it('rejects missing common directive', () => {
    const r = validateConfig(app(APP_CSP.replace("default-src 'self'", '')), 'vercel.json')
    expect(r).toContainEqual(expect.stringContaining('CSP missing directive "default-src"'))
  })

  it('rejects missing required source in common directive', () => {
    const r = validateConfig(
      app(APP_CSP.replace("default-src 'self'", "default-src 'none'")),
      'vercel.json',
    )
    expect(r).toContainEqual(expect.stringContaining('must include "\'self\'"'))
  })

  // -- app CSP rules --
  it('rejects missing wasm-unsafe-eval in app', () => {
    const r = validateConfig(app(APP_CSP.replace("'wasm-unsafe-eval'", '')), 'vercel.json')
    expect(r).toContainEqual(expect.stringContaining('must include "\'wasm-unsafe-eval\'"'))
  })

  it('rejects missing google fonts in app style-src', () => {
    const r = validateConfig(
      app(APP_CSP.replace('https://fonts.googleapis.com', '')),
      'vercel.json',
    )
    expect(r).toContainEqual(expect.stringContaining('must include "https://fonts.googleapis.com"'))
  })

  it('rejects http: in app connect-src', () => {
    const r = validateConfig(app(APP_CSP + ' http:'), 'vercel.json')
    expect(r).toContainEqual(expect.stringContaining('must NOT contain "http:"'))
  })

  it('rejects missing https: in app connect-src', () => {
    // Replace on a directive boundary to avoid hitting https:// in fonts URLs
    const csp = APP_CSP.replace("connect-src 'self' https:", "connect-src 'self'")
    const r = validateConfig(app(csp), 'vercel.json')
    expect(r).toContainEqual(expect.stringContaining('must include "https:"'))
  })

  it('rejects missing localhost:* in app connect-src', () => {
    const r = validateConfig(app(APP_CSP.replace('http://localhost:*', '')), 'vercel.json')
    expect(r).toContainEqual(expect.stringContaining('must include "http://localhost:*"'))
  })

  // -- app HTTP source audit --
  it('rejects non-loopback HTTP host in app connect-src', () => {
    const r = validateConfig(app(APP_CSP + ' http://evil.example'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://evil.example"'),
    )
  })

  it('rejects localhost.evil lookalike in app', () => {
    const r = validateConfig(app(APP_CSP + ' http://localhost.evil'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://localhost.evil"'),
    )
  })

  it('rejects malformed empty port in app', () => {
    const r = validateConfig(app(APP_CSP + ' http://localhost:'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://localhost:"'),
    )
  })

  it('rejects dashed lookalike in app', () => {
    const r = validateConfig(app(APP_CSP + ' http://localhost-hack'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://localhost-hack"'),
    )
  })

  it('rejects non-loopback IPv4 in app', () => {
    const r = validateConfig(app(APP_CSP + ' http://127.0.0.2'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://127.0.0.2"'),
    )
  })

  it('rejects non-loopback IPv6 in app', () => {
    const r = validateConfig(app(APP_CSP + ' http://[::2]'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://[::2]"'),
    )
  })

  it('rejects dotted IPv4 lookalike in app', () => {
    const r = validateConfig(app(APP_CSP + ' http://127.0.0.1.x'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://127.0.0.1.x"'),
    )
  })

  it('rejects IPv6 lookalike in app', () => {
    const r = validateConfig(app(APP_CSP + ' http://[::1].evil'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://[::1].evil"'),
    )
  })

  it('rejects uppercase HTTP source in app', () => {
    // parseCSP lowercases non-quoted tokens; audit uses the parsed value
    const r = validateConfig(app(APP_CSP + ' HTTP://EVIL.EXAMPLE'), 'vercel.json')
    expect(r).toContainEqual(
      expect.stringContaining('forbids non-loopback HTTP source "http://evil.example"'),
    )
  })

  it('accepts uppercase loopback hosts in app', () => {
    const modified = APP_CSP.replace(
      'http://localhost:* http://127.0.0.1:* http://[::1]:*',
      'HTTP://LOCALHOST:* HTTP://127.0.0.1:* HTTP://[::1]:*',
    )
    expect(validateConfig(app(modified), 'vercel.json')).toEqual([])
  })

  it('accepts app connect-src with numeric ports on loopback', () => {
    const csp =
      "default-src 'self'; object-src 'none'; frame-ancestors 'none'; " +
      "worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'; " +
      "style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
      "connect-src 'self' https: http://localhost:11434 http://127.0.0.1:8080 http://[::1]:3000"
    expect(validateConfig(app(csp), 'vercel.json')).toEqual([])
  })

  // -- docs CSP rules --
  it('rejects missing unsafe-inline in docs', () => {
    const r = validateConfig(docs(DOCS_CSP.replace("'unsafe-inline'", '')), 'docs/vercel.json')
    expect(r).toContainEqual(expect.stringContaining('must include "\'unsafe-inline\'"'))
  })

  it('rejects http: in docs connect-src', () => {
    const r = validateConfig(docs(DOCS_CSP + ' http:'), 'docs/vercel.json')
    expect(r).toContainEqual(expect.stringContaining('must NOT contain "http:"'))
  })

  it('rejects any HTTP source in docs', () => {
    const r = validateConfig(docs(DOCS_CSP + ' http://localhost'), 'docs/vercel.json')
    expect(r).toContainEqual(expect.stringContaining('forbids HTTP source "http://localhost"'))
  })

  it('rejects uppercase HTTP in docs', () => {
    // parseCSP lowercases non-quoted tokens; audit uses the parsed value
    const r = validateConfig(docs(DOCS_CSP + ' HTTP://EVIL.EXAMPLE'), 'docs/vercel.json')
    expect(r).toContainEqual(expect.stringContaining('forbids HTTP source "http://evil.example"'))
  })

  // -- multiple errors --
  it('returns multiple errors for multiple violations', () => {
    const csp = APP_CSP.replace("default-src 'self'", '').replace(' https:', '')
    const r = validateConfig(app(csp), 'vercel.json')
    expect(r.length).toBeGreaterThanOrEqual(2)
  })
})

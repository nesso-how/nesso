// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// These tests exercise the CSP validation logic from check-security-headers.mjs.
// The checker must NOT use permissive startsWith for loopback hosts — a lookalike
// like http://localhost.evil must be rejected, while http://localhost:11434 must be
// accepted.
//
// The CSP must support local Ollama on loopback hosts with arbitrary valid ports
// using exact allowed source tokens (localhost, 127.0.0.1, IPv6 loopback), while
// rejecting every other explicit http:// source.
// ---------------------------------------------------------------------------

import {
  parseCSP,
  sourceMatchesRequired,
  APP_CSP_RULES,
  DOCS_CSP_RULES,
  validateConnectSrcHttpSources,
  validateDocsNoHttpSources,
  validateDirectives,
} from './check-security-headers.mjs'

describe('parseCSP', () => {
  it('parses a CSP string into directive → source arrays', () => {
    const csp = parseCSP(
      "default-src 'self'; connect-src 'self' https: http://localhost:11434 http://[::1]:11434",
    )
    expect(csp.get('default-src')).toEqual(["'self'"])
    expect(csp.get('connect-src')).toEqual([
      "'self'",
      'https:',
      'http://localhost:11434',
      'http://[::1]:11434',
    ])
  })

  it('normalizes directive names and source tokens to lowercase', () => {
    const csp = parseCSP(
      "DEFAULT-SRC 'SELF'; CONNECT-SRC HTTPS://API.OPENAI.COM HTTP://LOCALHOST:11434",
    )
    expect(csp.get('default-src')).toEqual(["'SELF'"])
    expect(csp.get('connect-src')).toEqual(['https://api.openai.com', 'http://localhost:11434'])
  })

  it('preserves case of quoted keyword tokens', () => {
    // 'self', 'none', 'unsafe-inline', 'wasm-unsafe-eval' must keep their
    // original casing so they match rule constants verbatim.
    const csp = parseCSP("script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'")
    expect(csp.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", "'unsafe-inline'"])
  })

  it('does not lowercase blob: or data: scheme tokens', () => {
    // blob: and data: are schemes, not quoted keywords — they should be lowercased.
    const csp = parseCSP('worker-src blob: data:')
    expect(csp.get('worker-src')).toEqual(['blob:', 'data:'])
  })

  it('handles empty and whitespace-only tokens', () => {
    expect(parseCSP('')).toEqual(new Map())
    expect(parseCSP('  ; ;  ')).toEqual(new Map())
  })
})

describe('sourceMatchesRequired — exact, scheme, and edge cases', () => {
  it('exact match returns true', () => {
    expect(sourceMatchesRequired('http://localhost', 'http://localhost')).toBe(true)
  })

  it('scheme prefix matches anything starting with that scheme', () => {
    expect(sourceMatchesRequired('https://openai.example.com/v1', 'https:')).toBe(true)
    expect(sourceMatchesRequired('https:', 'https:')).toBe(true)
    expect(sourceMatchesRequired('http://localhost', 'https:')).toBe(false)
  })

  it('host-only exact match for 127.0.0.1', () => {
    expect(sourceMatchesRequired('http://127.0.0.1', 'http://127.0.0.1')).toBe(true)
  })

  it('rejects different but similar hosts', () => {
    expect(sourceMatchesRequired('http://127.0.0.2', 'http://127.0.0.1')).toBe(false)
  })

  it('bare host token uses prefix matching', () => {
    expect(sourceMatchesRequired('localhost', 'localhost')).toBe(true)
    expect(sourceMatchesRequired('localhost:11434', 'localhost')).toBe(true)
  })

  it("exact match for quoted 'self'", () => {
    expect(sourceMatchesRequired("'self'", "'self'")).toBe(true)
    expect(sourceMatchesRequired("'none'", "'self'")).toBe(false)
  })

  it('IPv6 loopback exact match returns true', () => {
    expect(sourceMatchesRequired('http://[::1]', 'http://[::1]')).toBe(true)
  })
})

describe('sourceMatchesRequired — loopback hosts with explicit ports', () => {
  it('loopback host with port is allowed (localhost)', () => {
    expect(sourceMatchesRequired('http://localhost:11434', 'http://localhost')).toBe(true)
  })

  it('loopback host with port is allowed (127.0.0.1)', () => {
    expect(sourceMatchesRequired('http://127.0.0.1:11434', 'http://127.0.0.1')).toBe(true)
  })

  it('loopback host with port is allowed (IPv6)', () => {
    expect(sourceMatchesRequired('http://[::1]:11434', 'http://[::1]')).toBe(true)
  })

  it('accepts any valid port on localhost', () => {
    expect(sourceMatchesRequired('http://localhost:8080', 'http://localhost')).toBe(true)
    expect(sourceMatchesRequired('http://localhost:3000', 'http://localhost')).toBe(true)
    expect(sourceMatchesRequired('http://localhost:0', 'http://localhost')).toBe(true)
    expect(sourceMatchesRequired('http://localhost:65535', 'http://localhost')).toBe(true)
  })

  it('accepts any valid port on 127.0.0.1', () => {
    expect(sourceMatchesRequired('http://127.0.0.1:8080', 'http://127.0.0.1')).toBe(true)
    expect(sourceMatchesRequired('http://127.0.0.1:3000', 'http://127.0.0.1')).toBe(true)
  })

  it('accepts any valid port on IPv6 loopback', () => {
    expect(sourceMatchesRequired('http://[::1]:8080', 'http://[::1]')).toBe(true)
    expect(sourceMatchesRequired('http://[::1]:65535', 'http://[::1]')).toBe(true)
  })

  it('rejects non-numeric port suffix', () => {
    expect(sourceMatchesRequired('http://localhost:evil', 'http://localhost')).toBe(false)
  })

  it('rejects empty port on loopback (colon only)', () => {
    expect(sourceMatchesRequired('http://localhost:', 'http://localhost')).toBe(false)
  })
})

describe('sourceMatchesRequired — wildcard port matching', () => {
  it(':* wildcard port exact match returns true', () => {
    expect(sourceMatchesRequired('http://localhost:*', 'http://localhost:*')).toBe(true)
  })

  it(':* wildcard port matches any numeric port on localhost', () => {
    expect(sourceMatchesRequired('http://localhost:11434', 'http://localhost:*')).toBe(true)
    expect(sourceMatchesRequired('http://localhost:8080', 'http://localhost:*')).toBe(true)
    expect(sourceMatchesRequired('http://localhost:0', 'http://localhost:*')).toBe(true)
    expect(sourceMatchesRequired('http://localhost:65535', 'http://localhost:*')).toBe(true)
  })

  it(':* wildcard port matches host-only (no port)', () => {
    expect(sourceMatchesRequired('http://localhost', 'http://localhost:*')).toBe(true)
  })

  it(':* wildcard port matches any numeric port on 127.0.0.1', () => {
    expect(sourceMatchesRequired('http://127.0.0.1:11434', 'http://127.0.0.1:*')).toBe(true)
    expect(sourceMatchesRequired('http://127.0.0.1', 'http://127.0.0.1:*')).toBe(true)
  })

  it(':* wildcard port matches any numeric port on IPv6 loopback', () => {
    expect(sourceMatchesRequired('http://[::1]:11434', 'http://[::1]:*')).toBe(true)
    expect(sourceMatchesRequired('http://[::1]', 'http://[::1]:*')).toBe(true)
  })

  it(':* wildcard port REJECTS non-numeric port', () => {
    expect(sourceMatchesRequired('http://localhost:evil', 'http://localhost:*')).toBe(false)
  })

  it(':* wildcard port REJECTS empty port (colon only)', () => {
    expect(sourceMatchesRequired('http://localhost:', 'http://localhost:*')).toBe(false)
  })

  it(':* wildcard port REJECTS lookalike host', () => {
    expect(sourceMatchesRequired('http://localhost.evil', 'http://localhost:*')).toBe(false)
  })

  it(':* wildcard port REJECTS non-loopback IP', () => {
    expect(sourceMatchesRequired('http://127.0.0.2:11434', 'http://127.0.0.1:*')).toBe(false)
  })
})

describe('sourceMatchesRequired — lookalike and malicious host rejection', () => {
  it('REJECTS lookalike host: localhost.evil', () => {
    expect(sourceMatchesRequired('http://localhost.evil', 'http://localhost')).toBe(false)
  })

  it('REJECTS lookalike host with port: localhost.evil:11434', () => {
    expect(sourceMatchesRequired('http://localhost.evil:11434', 'http://localhost')).toBe(false)
  })

  it('REJECTS arbitrary HTTP host: 1.2.3.4', () => {
    expect(sourceMatchesRequired('http://1.2.3.4', 'http://127.0.0.1')).toBe(false)
  })

  it('REJECTS arbitrary HTTP host with port', () => {
    expect(sourceMatchesRequired('http://1.2.3.4:11434', 'http://127.0.0.1')).toBe(false)
  })

  it('REJECTS arbitrary named host: evil.example', () => {
    expect(sourceMatchesRequired('http://evil.example', 'http://localhost')).toBe(false)
  })

  it('REJECTS arbitrary named host with port', () => {
    expect(sourceMatchesRequired('http://evil.example:11434', 'http://localhost')).toBe(false)
  })

  it('REJECTS localhost subdomain lookalike', () => {
    expect(sourceMatchesRequired('http://sub.localhost', 'http://localhost')).toBe(false)
  })

  it('REJECTS IPv6 lookalike', () => {
    expect(sourceMatchesRequired('http://[::2]', 'http://[::1]')).toBe(false)
    expect(sourceMatchesRequired('http://[::1].evil', 'http://[::1]')).toBe(false)
  })

  it('REJECTS malformed host that starts with loopback prefix', () => {
    expect(sourceMatchesRequired('http://localhost-hack', 'http://localhost')).toBe(false)
  })
})

describe('sourceMatchesRequired — origin boundary rejection', () => {
  it('REJECTS google fonts origin lookalike', () => {
    expect(
      sourceMatchesRequired('https://fonts.googleapis.com.evil', 'https://fonts.googleapis.com'),
    ).toBe(false)
    expect(
      sourceMatchesRequired(
        'https://fonts.googleapis.com.evil/css2',
        'https://fonts.googleapis.com',
      ),
    ).toBe(false)
  })

  it('REJECTS google fonts origin lookalike with explicit port', () => {
    expect(
      sourceMatchesRequired(
        'https://fonts.googleapis.com.evil:443',
        'https://fonts.googleapis.com',
      ),
    ).toBe(false)
  })

  it('REJECTS google static fonts origin lookalike', () => {
    expect(
      sourceMatchesRequired('https://fonts.gstatic.com.evil', 'https://fonts.gstatic.com'),
    ).toBe(false)
    expect(
      sourceMatchesRequired('https://fonts.gstatic.com.evil/s/roboto', 'https://fonts.gstatic.com'),
    ).toBe(false)
  })

  it('REJECTS google fonts origin lookalike with path after evil domain', () => {
    expect(
      sourceMatchesRequired(
        'https://fonts.googleapis.com.evil/css2?family=Roboto',
        'https://fonts.googleapis.com',
      ),
    ).toBe(false)
  })
})

describe('sourceMatchesRequired — origin boundary acceptance', () => {
  it('ACCEPTS valid google fonts paths (boundary /)', () => {
    expect(
      sourceMatchesRequired('https://fonts.googleapis.com/css2', 'https://fonts.googleapis.com'),
    ).toBe(true)
    expect(
      sourceMatchesRequired(
        'https://fonts.googleapis.com/css2?family=Roboto',
        'https://fonts.googleapis.com',
      ),
    ).toBe(true)
  })

  it('ACCEPTS valid google static fonts paths (boundary /)', () => {
    expect(
      sourceMatchesRequired(
        'https://fonts.gstatic.com/s/roboto/v30/file.woff2',
        'https://fonts.gstatic.com',
      ),
    ).toBe(true)
  })

  it('ACCEPTS exact origin match', () => {
    expect(
      sourceMatchesRequired('https://fonts.googleapis.com', 'https://fonts.googleapis.com'),
    ).toBe(true)
    expect(sourceMatchesRequired('https://fonts.gstatic.com', 'https://fonts.gstatic.com')).toBe(
      true,
    )
  })
})

describe('sourceMatchesRequired — case-insensitive matching', () => {
  it('matches uppercase scheme prefix case-insensitively', () => {
    expect(sourceMatchesRequired('HTTPS://api.openai.com/v1', 'https:')).toBe(true)
  })

  it('matches uppercase loopback host case-insensitively', () => {
    expect(sourceMatchesRequired('HTTP://LOCALHOST:11434', 'http://localhost:*')).toBe(true)
    expect(sourceMatchesRequired('HTTP://LOCALHOST', 'http://localhost')).toBe(true)
    expect(sourceMatchesRequired('Http://127.0.0.1:8080', 'http://127.0.0.1')).toBe(true)
    expect(sourceMatchesRequired('HTTP://[::1]:3000', 'http://[::1]')).toBe(true)
  })

  it('REJECTS uppercase lookalike host case-insensitively', () => {
    expect(sourceMatchesRequired('HTTP://LOCALHOST.EVIL', 'http://localhost')).toBe(false)
    expect(sourceMatchesRequired('HTTP://LOCALHOST.EVIL:11434', 'http://localhost')).toBe(false)
  })

  it('REJECTS uppercase arbitrary HTTP host', () => {
    expect(sourceMatchesRequired('HTTP://EVIL.EXAMPLE:11434', 'http://localhost')).toBe(false)
    expect(sourceMatchesRequired('HTTP://1.2.3.4', 'http://127.0.0.1')).toBe(false)
  })
})

describe('sourceMatchesRequired — app CSP rules completeness', () => {
  it('APP_CSP_RULES requires all three loopback hosts', () => {
    const rules = APP_CSP_RULES.filter((r) => r.directive === 'connect-src' && r.mustContain)
    const requiredHosts = rules.flatMap((r) => r.mustContain ?? [])
    expect(requiredHosts).toContain('http://localhost:*')
    expect(requiredHosts).toContain('http://127.0.0.1:*')
    expect(requiredHosts).toContain('http://[::1]:*')
  })

  it('APP_CSP_RULES forbids bare http: scheme', () => {
    const httpRule = APP_CSP_RULES.find((r) => r.directive === 'connect-src' && r.mustNotContain)
    expect(httpRule?.mustNotContain).toContain('http:')
  })

  it('APP_CSP_RULES requires https: scheme for remote endpoints', () => {
    const httpsRule = APP_CSP_RULES.find(
      (r) => r.directive === 'connect-src' && r.mustContain && r.mustContain.includes('https:'),
    )
    expect(httpsRule).toBeDefined()
  })
})

describe('validateConnectSrcHttpSources — accepts valid loopback sources', () => {
  it('accepts all three wildcard-port loopback hosts', () => {
    const sources = [
      "'self'",
      'https:',
      'http://localhost:*',
      'http://127.0.0.1:*',
      'http://[::1]:*',
    ]
    expect(validateConnectSrcHttpSources(sources, 'vercel.json')).toEqual([])
  })

  it('accepts explicit loopback hosts with numeric ports', () => {
    const sources = [
      "'self'",
      'http://localhost:11434',
      'http://127.0.0.1:8080',
      'http://[::1]:3000',
    ]
    expect(validateConnectSrcHttpSources(sources, 'vercel.json')).toEqual([])
  })

  it('accepts mix of wildcard ports and numeric ports', () => {
    const sources = [
      "'self'",
      'https:',
      'http://localhost:*',
      'http://127.0.0.1:11434',
      'http://[::1]:*',
    ]
    expect(validateConnectSrcHttpSources(sources, 'vercel.json')).toEqual([])
  })

  it('returns empty errors for non-HTTP sources only', () => {
    const sources = ["'self'", 'https:', 'blob:', "'unsafe-inline'"]
    expect(validateConnectSrcHttpSources(sources, 'vercel.json')).toEqual([])
  })
})

describe('validateConnectSrcHttpSources — rejects non-loopback hosts', () => {
  it('REJECTS evil.example host', () => {
    const sources = ['http://evil.example']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('forbids non-loopback HTTP source')
    expect(errors[0]).toContain('http://evil.example')
  })

  it('REJECTS localhost.evil lookalike', () => {
    const sources = ['http://localhost.evil']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://localhost.evil')
  })

  it('REJECTS localhost subdomain lookalike', () => {
    const sources = ['http://sub.localhost']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://sub.localhost')
  })

  it('REJECTS non-loopback IPv4', () => {
    const sources = ['http://1.2.3.4', 'http://192.168.1.1']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(2)
    expect(errors[0]).toContain('http://1.2.3.4')
    expect(errors[1]).toContain('http://192.168.1.1')
  })

  it('REJECTS non-loopback IPv6', () => {
    const sources = ['http://[::2]']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://[::2]')
  })
})

describe('validateConnectSrcHttpSources — rejects malformed ports and edge cases', () => {
  it('REJECTS malformed port (empty port)', () => {
    const sources = ['http://localhost:']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://localhost:')
  })

  it('REJECTS malformed port (non-digit port)', () => {
    const sources = ['http://localhost:evil']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://localhost:evil')
  })

  it('REJECTS localhost-hack dashed lookalike', () => {
    const sources = ['http://localhost-hack']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://localhost-hack')
  })

  it('REJECTS 127.0.0.1.x dotted lookalike', () => {
    const sources = ['http://127.0.0.1.x']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://127.0.0.1.x')
  })

  it('REJECTS [::1].evil IPv6 lookalike', () => {
    const sources = ['http://[::1].evil']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://[::1].evil')
  })
})

describe('validateConnectSrcHttpSources — case-insensitive handling', () => {
  it('REJECTS uppercase malicious HTTP source', () => {
    const sources = ['HTTP://EVIL.EXAMPLE']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('forbids non-loopback HTTP source')
    expect(errors[0]).toContain('HTTP://EVIL.EXAMPLE')
  })

  it('REJECTS uppercase localhost lookalike', () => {
    const sources = ['HTTP://LOCALHOST.EVIL']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('HTTP://LOCALHOST.EVIL')
  })

  it('accepts uppercase loopback hosts after normalization', () => {
    const sources = ['HTTP://LOCALHOST:*', 'HTTP://127.0.0.1:11434', 'HTTP://[::1]:*']
    const errors = validateConnectSrcHttpSources(sources, 'vercel.json')
    expect(errors).toEqual([])
  })
})

describe('validateDirectives (case-insensitive mustNotContain)', () => {
  it('rejects uppercase http: scheme token via mustNotContain', () => {
    // Simulate a parsed CSP where someone wrote connect-src ... HTTP:
    // The parser lowercases it to http:, so the mustNotContain check catches it.
    const csp = parseCSP(
      "default-src 'self'; object-src 'none'; frame-ancestors 'none'; worker-src 'self' blob:; script-src 'self'; connect-src 'self' HTTP:",
    )
    const errors = validateDirectives(csp, APP_CSP_RULES, 'vercel.json')
    expect(errors.some((e) => e.includes('must NOT contain "http:"'))).toBe(true)
  })

  it('rejects mixed-case http: scheme token via mustNotContain', () => {
    const csp = parseCSP(
      "default-src 'self'; object-src 'none'; frame-ancestors 'none'; worker-src 'self' blob:; script-src 'self'; connect-src 'self' Http:",
    )
    const errors = validateDirectives(csp, APP_CSP_RULES, 'vercel.json')
    expect(errors.some((e) => e.includes('must NOT contain'))).toBe(true)
  })
})

describe('validateDocsNoHttpSources', () => {
  it('returns no errors when docs connect-src has no HTTP sources', () => {
    const sources = ["'self'", 'https:']
    expect(validateDocsNoHttpSources(sources, 'docs/vercel.json')).toEqual([])
  })

  it('REJECTS http://localhost in docs connect-src', () => {
    const sources = ["'self'", 'http://localhost']
    const errors = validateDocsNoHttpSources(sources, 'docs/vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('forbids HTTP source')
    expect(errors[0]).toContain('http://localhost')
  })

  it('REJECTS http://localhost:* in docs connect-src', () => {
    const sources = ["'self'", 'http://localhost:*']
    const errors = validateDocsNoHttpSources(sources, 'docs/vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://localhost:*')
  })

  it('REJECTS http://127.0.0.1 in docs connect-src', () => {
    const sources = ["'self'", 'http://127.0.0.1']
    const errors = validateDocsNoHttpSources(sources, 'docs/vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://127.0.0.1')
  })

  it('REJECTS http://[::1] in docs connect-src', () => {
    const sources = ["'self'", 'http://[::1]']
    const errors = validateDocsNoHttpSources(sources, 'docs/vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('http://[::1]')
  })

  it('REJECTS uppercase HTTP://EVIL.EXAMPLE in docs connect-src', () => {
    const sources = ["'self'", 'HTTP://EVIL.EXAMPLE:11434']
    const errors = validateDocsNoHttpSources(sources, 'docs/vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('HTTP://EVIL.EXAMPLE:11434')
  })

  it('REJECTS uppercase HTTP://LOCALHOST:* in docs connect-src', () => {
    const sources = ["'self'", 'HTTP://LOCALHOST:*']
    const errors = validateDocsNoHttpSources(sources, 'docs/vercel.json')
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('HTTP://LOCALHOST:*')
  })

  it('accepts https: and non-http sources in docs', () => {
    const sources = ["'self'", 'https:', 'https://fonts.googleapis.com']
    expect(validateDocsNoHttpSources(sources, 'docs/vercel.json')).toEqual([])
  })
})

describe('sourceMatchesRequired — quoted keywords accept valid casing', () => {
  it("ACCEPTS 'SELF' as match for must-contain 'self'", () => {
    expect(sourceMatchesRequired("'SELF'", "'self'")).toBe(true)
  })

  it("ACCEPTS 'None' as match for must-contain 'none'", () => {
    expect(sourceMatchesRequired("'None'", "'none'")).toBe(true)
  })

  it("ACCEPTS 'Unsafe-Inline' as match for 'unsafe-inline'", () => {
    expect(sourceMatchesRequired("'Unsafe-Inline'", "'unsafe-inline'")).toBe(true)
  })

  it("ACCEPTS 'Wasm-Unsafe-Eval' as match for 'wasm-unsafe-eval'", () => {
    expect(sourceMatchesRequired("'Wasm-Unsafe-Eval'", "'wasm-unsafe-eval'")).toBe(true)
  })

  it("REJECTS 'self' (missing single quotes) against 'self'", () => {
    expect(sourceMatchesRequired('self', "'self'")).toBe(false)
  })
})

describe('validateDirectives — COMMON_DIRECTIVES accept mixed-case quoted keywords', () => {
  it('accepts default-src with uppercase quoted self', () => {
    const csp = parseCSP(
      "default-src 'SELF'; object-src 'NONE'; frame-ancestors 'None'; worker-src 'Self' blob:",
    )
    const rules = [
      { directive: 'default-src', mustContain: ["'self'"] },
      { directive: 'object-src', mustContain: ["'none'"] },
      { directive: 'frame-ancestors', mustContain: ["'none'"] },
      { directive: 'worker-src', mustContain: ["'self'", 'blob:'] },
    ]
    const errors = validateDirectives(csp, rules, 'vercel.json')
    expect(errors).toEqual([])
  })

  it('rejects missing quoted keyword even with correct casing rule', () => {
    const csp = parseCSP("default-src 'none'; object-src 'none'")
    const rules = [
      { directive: 'default-src', mustContain: ["'self'"] },
      { directive: 'object-src', mustContain: ["'none'"] },
    ]
    const errors = validateDirectives(csp, rules, 'vercel.json')
    expect(errors.some((e) => e.includes('default-src'))).toBe(true)
  })
})

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { setTimeout } from 'node:timers/promises'
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose'
import { z } from 'zod'
import { ElectronError } from './errors.ts'

const issuer = 'https://auth.openai.com'
const resource = 'https://api.openai.com/v1'
const tokenEndpoint = `${issuer}/api/accounts/oauth/token`
const scopes = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
const secret = z.string().min(1).max(32_768)
export const chatGptAccount = z.object({
  id: z.uuid(),
  clientId: z.string().min(1).max(256).refine((value) => value !== 'dynamic_agent_client'),
  subject: z.string().min(1).max(256),
  email: z.email().max(320),
  session: z.object({
    accessToken: secret,
    refreshToken: secret,
    idToken: secret,
    expiresAt: z.number().int().positive(),
    scopes: z.array(z.string()),
  }).optional(),
})
type Account = z.infer<typeof chatGptAccount>
const tokens = z.object({
  access_token: secret,
  refresh_token: secret,
  id_token: secret.optional(),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
  expires_in: z.number().int().positive().max(86_400),
  scope: z.string().min(1),
})
const fail = (message: string): never => { throw new ElectronError([{ path: 'oauth', message }]) }

export function createChatGptAuth(openBrowser: (url: string) => Promise<void>, request: typeof fetch = fetch) {
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
    [customFetch]: (url, options) => request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15_000) }),
  })
  const identity = async (idToken: string, clientId: string, nonce?: string) => {
    try {
      const { payload } = await jwtVerify(idToken, jwks, { issuer, audience: clientId, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5 })
      if (!payload.sub || !z.email().safeParse(payload.email).success || nonce !== undefined && payload.nonce !== nonce) return fail('Invalid ChatGPT identity')
      return { subject: payload.sub, email: payload.email as string }
    } catch { return fail('Could not validate the ChatGPT identity') }
  }
  const exchange = async (body: URLSearchParams, signal?: AbortSignal) => {
    let response: Response
    try {
      response = await request(tokenEndpoint, { method: 'POST', body, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]) })
    } catch { return fail('ChatGPT authentication failed or timed out') }
    if (!response.ok) return fail(response.status === 400 || response.status === 401 ? 'ChatGPT session expired or was revoked. Sign in again' : 'ChatGPT authentication is temporarily unavailable')
    let parsed: z.infer<typeof tokens>
    try { parsed = tokens.parse(await response.json()) } catch { return fail('Invalid ChatGPT token response') }
    const granted = parsed.scope.split(/\s+/)
    if (!['chatgpt.tokens.use.direct', 'resource.invoke', 'offline_access'].every((scope) => granted.includes(scope))) return fail('ChatGPT plan usage was not authorized. Sign in again and allow plan usage')
    return { ...parsed, scopes: granted }
  }
  return {
    signIn: async (hostId: string, previous?: Account, signal?: AbortSignal): Promise<Account> => {
      const attempt = AbortSignal.any([AbortSignal.timeout(180_000), ...(signal ? [signal] : [])])
      const state = randomBytes(32).toString('base64url')
      const nonce = randomBytes(32).toString('base64url')
      const verifier = randomBytes(32).toString('base64url')
      let redirectUri = ''
      let completed = false
      let settle!: (value: { code: string; clientId: string }) => void
      let reject!: (error: ElectronError) => void
      const callback = new Promise<{ code: string; clientId: string }>((resolve, fail) => { settle = resolve; reject = fail })
      void callback.catch(() => {})
      const server = createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        if (completed) { res.writeHead(410).end('This sign-in attempt has already finished'); return }
        let url: URL
        try { url = new URL(req.url ?? '/', redirectUri) } catch { res.writeHead(400).end('Invalid callback'); return }
        if (req.method !== 'GET' || req.headers.host !== new URL(redirectUri).host || url.origin !== new URL(redirectUri).origin || url.pathname !== '/auth/callback') {
          res.writeHead(404).end('Not found')
          return
        }
        const params = url.searchParams
        if (params.getAll('state').length !== 1 || params.get('state') !== state) {
          res.writeHead(400).end('Invalid authorization state')
          return
        }
        const clientId = previous?.clientId ?? params.get('client_id')
        if (params.has('error') || !params.get('code') || params.getAll('code').length !== 1 || !clientId || clientId === 'dynamic_agent_client'
          || params.getAll('client_id').length > 1 || previous && params.has('client_id') && params.get('client_id') !== previous.clientId) {
          res.writeHead(400).end('Sign-in was not completed. Return to Nesso.')
          completed = true
          reject(new ElectronError([{ path: 'oauth', message: 'ChatGPT sign-in was declined or returned an invalid callback' }]))
          return
        }
        res.end('You can close this window and return to Nesso.')
        completed = true
        settle({ code: params.get('code')!, clientId })
      })
      const abort = () => reject(new ElectronError([{ path: 'oauth', message: 'ChatGPT sign-in was cancelled or timed out' }]))
      attempt.addEventListener('abort', abort, { once: true })
      try {
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
        const address = server.address()
        if (!address || typeof address === 'string') return fail('Could not start the ChatGPT sign-in callback')
        redirectUri = `http://127.0.0.1:${address.port}/auth/callback`
        const query = new URLSearchParams({
          client_id: previous?.clientId ?? 'dynamic_agent_client', ext_agent_host_id: hostId,
          response_type: 'code', redirect_uri: redirectUri, scope: scopes, resource, state, nonce,
          code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
          ...(!previous ? { agent_name_hint: 'Nesso' } : {}),
          ...(previous?.session ? { id_token_hint: previous.session.idToken, login_hint: previous.email } : {}),
        })
        attempt.throwIfAborted()
        await openBrowser(`${issuer}/api/accounts/authorize?${query}`)
        const { code, clientId } = await callback
        const token = await exchange(new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri, resource }), attempt)
        if (!token.id_token) return fail('ChatGPT did not return an identity token')
        const user = await identity(token.id_token, clientId, nonce)
        if (previous && user.subject !== previous.subject) return fail('The signed-in ChatGPT account does not match the selected account')
        attempt.throwIfAborted()
        return { id: previous?.id ?? randomUUID(), clientId, ...user, session: {
          accessToken: token.access_token, refreshToken: token.refresh_token, idToken: token.id_token,
          expiresAt: Date.now() + token.expires_in * 1000, scopes: token.scopes,
        } }
      } catch (error) {
        if (error instanceof ElectronError) throw error
        return fail('ChatGPT sign-in failed or was cancelled')
      } finally {
        attempt.removeEventListener('abort', abort)
        server.close()
        server.closeAllConnections()
      }
    },
    refresh: async (account: Account): Promise<Account> => {
      if (!account.session) return fail('Sign in to the selected ChatGPT account')
      const token = await exchange(new URLSearchParams({ grant_type: 'refresh_token', client_id: account.clientId, refresh_token: account.session.refreshToken, resource }))
      if (token.id_token && (await identity(token.id_token, account.clientId)).subject !== account.subject) return fail('Refreshed ChatGPT identity does not match the selected account')
      return { ...account, session: {
        accessToken: token.access_token, refreshToken: token.refresh_token, idToken: token.id_token ?? account.session.idToken,
        expiresAt: Date.now() + token.expires_in * 1000, scopes: token.scopes,
      } }
    },
    revoke: async (account: Account): Promise<boolean> => {
      if (!account.session) return true
      try {
        const metadata = await request(`${issuer}/.well-known/openid-configuration`, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
        if (!metadata.ok) return false
        const config = z.object({ issuer: z.literal(issuer), revocation_endpoint: z.url() }).parse(await metadata.json())
        if (new URL(config.revocation_endpoint).origin !== issuer) return false
        for (const delay of [0, 250, 750]) {
          if (delay) await setTimeout(delay)
          try {
            const response = await request(config.revocation_endpoint, {
              method: 'POST', body: new URLSearchParams({ token: account.session.refreshToken, token_type_hint: 'refresh_token', client_id: account.clientId }),
              redirect: 'error', signal: AbortSignal.timeout(15_000),
            })
            if (response.status === 200) return true
            if (response.status < 500) return false
          } catch {}
        }
        return false
      } catch { return false }
    },
  }
}

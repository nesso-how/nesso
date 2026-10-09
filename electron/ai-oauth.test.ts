import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createChatGptAuth } from './ai-oauth.ts'
import { ElectronError } from './errors.ts'

const issuer = 'https://auth.openai.com'
const granted = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
const fixture = async (invalid?: string) => {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...await exportJWK(publicKey), kid: 'test', alg: 'RS256', use: 'sig' }
  let authorization: URL
  const grants: URLSearchParams[] = []
  const request: typeof fetch = async (url, options) => {
    assert.equal(options?.redirect, 'error')
    if (String(url).endsWith('/.well-known/jwks.json')) return Response.json({ keys: [jwk] })
    assert.equal(url, `${issuer}/api/accounts/oauth/token`)
    const body = options?.body as URLSearchParams
    grants.push(body)
    assert.equal(body.get('client_id'), 'oaiapp_test')
    assert.equal(body.get('resource'), 'https://api.openai.com/v1')
    if (body.get('grant_type') === 'authorization_code') {
      assert.equal(body.get('redirect_uri'), authorization.searchParams.get('redirect_uri'))
      assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'), authorization.searchParams.get('code_challenge'))
    }
    let jwt = new SignJWT({ email: 'user@example.com', nonce: invalid === 'nonce' ? 'wrong' : authorization.searchParams.get('nonce') })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(invalid === 'issuer' ? 'https://other.example' : issuer)
      .setAudience(invalid === 'audience' ? 'other-client' : 'oaiapp_test')
      .setSubject(invalid === 'identity' ? 'other-user' : 'test-user')
      .setIssuedAt()
    if (invalid !== 'missing-exp') jwt = jwt.setExpirationTime(invalid === 'expired' ? Math.floor(Date.now() / 1000) - 60 : '1h')
    const idToken = await jwt.sign(invalid === 'signature' ? (await generateKeyPair('RS256')).privateKey : privateKey)
    return Response.json({
      access_token: 'access-secret', refresh_token: 'refresh-secret', id_token: idToken,
      token_type: 'Bearer', expires_in: 3600, scope: invalid === 'scopes' ? 'openid profile email' : granted,
    })
  }
  const openBrowser = async (value: string) => {
    authorization = new URL(value)
    assert.equal(authorization.origin, issuer)
    assert.equal(authorization.pathname, '/api/accounts/authorize')
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(authorization.searchParams.get('ext_agent_host_id'), 'urn:uuid:11111111-1111-4111-8111-111111111111')
    const callback = new URL(authorization.searchParams.get('redirect_uri')!)
    assert.equal(callback.hostname, '127.0.0.1')
    if (!invalid && grants.length === 0) {
      callback.search = new URLSearchParams({ state: 'wrong', code: 'invalid', client_id: 'oaiapp_test' }).toString()
      assert.equal((await fetch(callback)).status, 400)
      callback.searchParams.set('state', authorization.searchParams.get('state')!)
      callback.searchParams.append('state', authorization.searchParams.get('state')!)
      assert.equal((await fetch(callback)).status, 400)
      assert.equal(grants.length, 0)
    }
    callback.search = new URLSearchParams({ state: authorization.searchParams.get('state')!, code: 'code', client_id: invalid === 'client' ? 'different-client' : 'oaiapp_test' }).toString()
    await fetch(callback)
  }
  return { auth: createChatGptAuth(openBrowser, request), grants, authorization: () => authorization }
}
const hostId = 'urn:uuid:11111111-1111-4111-8111-111111111111'

test('ChatGPT OAuth uses dynamic registration, loopback, state, PKCE and signed identity, then reuses the issued client', async () => {
  const { auth, grants, authorization } = await fixture()
  const account = await auth.signIn(hostId)
  assert.equal(account.subject, 'test-user')
  assert.equal(account.email, 'user@example.com')
  assert.equal(account.session?.accessToken, 'access-secret')
  assert.equal(authorization().searchParams.get('client_id'), 'dynamic_agent_client')
  assert.equal(authorization().searchParams.get('agent_name_hint'), 'Nesso')
  const firstState = authorization().searchParams.get('state')
  const returning = await auth.signIn(hostId, account)
  assert.equal(returning.id, account.id)
  assert.equal(authorization().searchParams.get('client_id'), account.clientId)
  assert.equal(authorization().searchParams.has('agent_name_hint'), false)
  assert.equal(authorization().searchParams.get('id_token_hint'), account.session?.idToken)
  assert.notEqual(authorization().searchParams.get('state'), firstState)
  await auth.refresh(returning)
  assert.equal(grants.at(-1)?.get('grant_type'), 'refresh_token')
  assert.equal(grants.at(-1)?.get('refresh_token'), 'refresh-secret')
  assert.equal(grants.at(-1)?.has('scope'), false)
})

test('ChatGPT OAuth rejects invalid JWTs, missing plan permission and a different returning identity or client', async () => {
  for (const invalid of ['signature', 'issuer', 'audience', 'expired', 'nonce', 'missing-exp', 'scopes', 'identity', 'client']) {
    const { auth } = await fixture(invalid)
    const previous = ['identity', 'client'].includes(invalid) ? {
      id: '11111111-1111-4111-8111-111111111111', clientId: 'oaiapp_test', subject: 'test-user', email: 'user@example.com',
    } : undefined
    await assert.rejects(auth.signIn(hostId, previous), (error) => error instanceof ElectronError && !error.message.includes('secret'))
  }
})

test('cancelled and declined ChatGPT sign-in closes the listener without exchanging tokens', async () => {
  for (const mode of ['cancel', 'decline']) {
    const controller = new AbortController()
    let callback: URL | undefined
    let requests = 0
    const auth = createChatGptAuth(async (value) => {
      const url = new URL(value)
      callback = new URL(url.searchParams.get('redirect_uri')!)
      if (mode === 'cancel') controller.abort()
      else {
        callback.search = new URLSearchParams({ state: url.searchParams.get('state')!, error: 'access_denied' }).toString()
        await fetch(callback)
      }
    }, async () => { requests++; throw new Error('Unexpected token exchange') })
    await assert.rejects(auth.signIn(hostId, undefined, controller.signal), ElectronError)
    assert.equal(requests, 0)
    await assert.rejects(fetch(callback!))
  }
})

test('revocation uses discovered trusted metadata and never sends credentials to another origin', async () => {
  const account = {
    id: '11111111-1111-4111-8111-111111111111', clientId: 'oaiapp_test', subject: 'test-user', email: 'user@example.com',
    session: { accessToken: 'access', refreshToken: 'refresh', idToken: 'id', expiresAt: Date.now() + 3600_000, scopes: granted.split(' ') },
  }
  for (const remote of [false, true]) {
    let revocations = 0
    const auth = createChatGptAuth(async () => {}, async (url, options) => {
      if (String(url).endsWith('/openid-configuration')) return Response.json({ issuer, revocation_endpoint: remote ? 'https://other.example/revoke' : `${issuer}/api/accounts/oauth/revoke` })
      revocations++
      assert.equal(url, `${issuer}/api/accounts/oauth/revoke`)
      const body = options?.body
      assert.ok(body instanceof URLSearchParams)
      assert.equal(body.get('token'), 'refresh')
      assert.equal(body.get('client_id'), account.clientId)
      return new Response(null, { status: 200 })
    })
    assert.equal(await auth.revoke(account), !remote)
    assert.equal(revocations, remote ? 0 : 1)
  }
})

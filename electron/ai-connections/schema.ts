import { z } from 'zod'
import { aiConnectionInput } from '@nesso-how/ai/providers'
import { chatGptAccount } from '../ai-oauth.ts'

const secureEndpoint = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  return (
    (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  )
}
const endpoint = z.string().max(2048).pipe(z.url()).refine(secureEndpoint, {
  message: 'Use HTTPS, or HTTP on localhost, without credentials, query or fragment',
})
export const connectionInput = aiConnectionInput.safeExtend({
  endpoint: aiConnectionInput.shape.endpoint
    .pipe(endpoint)
    .transform((value) => value.replace(/\/+$/, '')),
})
const text = (max = 256) =>
  z
    .string()
    .max(max)
    .refine((value) => !!value.trim())
const storedConnection = aiConnectionInput
  .safeExtend({
    id: text(),
    name: text(80),
    endpoint,
    model: text(),
    apiKey: z.string().max(8192),
    accountId: text().optional(),
  })
  .strict()
  .refine(
    (entry) =>
      entry.authentication === 'chatgpt'
        ? !!entry.accountId && !entry.apiKey
        : entry.provider === 'custom' || !!entry.apiKey,
    { path: ['apiKey'], message: 'Credentials required for the selected authentication method' },
  )
const storedAccount = chatGptAccount
  .safeExtend({ session: chatGptAccount.shape.session.unwrap().strict().optional() })
  .strict()

export const storedRecord = z
  .strictObject({
    version: z.literal(1),
    connections: z.array(storedConnection),
    activeId: z.string().nullable(),
    hostId: z
      .string()
      .regex(/^urn:uuid:[0-9a-f-]{36}$/)
      .optional(),
    accounts: z.array(storedAccount).max(1).optional(),
  })
  .refine(
    ({ connections }) => new Set(connections.map(({ id }) => id)).size === connections.length,
    { path: ['connections'], message: 'Duplicate connection ID' },
  )
  .refine(
    ({ connections, activeId }) =>
      activeId === null || connections.some(({ id }) => id === activeId),
    { path: ['activeId'], message: 'Invalid active connection' },
  )
  .refine(
    ({ connections }) =>
      connections.filter((entry) => entry.authentication === 'chatgpt').length <= 1,
    { path: ['connections'], message: 'Only one ChatGPT connection is allowed' },
  )
  .refine(({ accounts, hostId }) => !accounts?.length || !!hostId, {
    path: ['hostId'],
    message: 'ChatGPT accounts require a persisted host ID',
  })
  .refine(
    ({ connections, accounts }) =>
      connections.every(
        (entry) =>
          entry.authentication !== 'chatgpt' || accounts?.some(({ id }) => id === entry.accountId),
      ),
    { path: ['accountId'], message: 'Unknown ChatGPT account' },
  )

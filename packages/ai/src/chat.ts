import { z } from 'zod'
import { locales } from '@nesso/i18n'
import type { AiToolResults } from './results.ts'

const aiChatMessage = z.strictObject({
  id: z.string().min(1).max(128),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(100_000),
  outcome: z.enum(['complete', 'applied', 'cancelled', 'error']).optional(),
})
export const aiConversation = z.strictObject({ version: z.literal(1), messages: z.array(aiChatMessage).max(500) })
export const aiChatRequest = z.strictObject({
  id: z.string().min(1).max(128),
  messages: z.array(aiChatMessage).min(1).max(500),
  context: z.string().max(32_000),
  locale: z.enum(locales),
})
export type AiChatMessage = z.infer<typeof aiChatMessage>
export type AiChatRequest = z.infer<typeof aiChatRequest>
export type AiChatEvent = { readonly id: string } & (
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'tool'; readonly callId: string; readonly name: string; readonly input: unknown }
)
export type AiToolReply = { readonly id: string; readonly callId: string; readonly result: import('./providers.ts').AiResult<AiToolResults[keyof AiToolResults]> }

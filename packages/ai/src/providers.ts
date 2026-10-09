import { z } from 'zod'

export const aiProviders = {
  openai: { name: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  anthropic: { name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1' },
  gemini: { name: 'Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  openrouter: { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1' },
  custom: { name: 'OpenAI-compatible', endpoint: 'http://localhost:11434/v1' },
} as const

export type AiProvider = keyof typeof aiProviders
const text = (max = 256) => z.string().max(max).trim().min(1)
export const aiConnectionInput = z.object({
  id: text().optional(),
  name: text(80),
  provider: z.enum(Object.keys(aiProviders) as AiProvider[]),
  endpoint: text(2048).pipe(z.url()),
  model: text(),
  apiKey: z.string().max(8192).trim().optional(),
})
export type AiConnectionInput = Readonly<z.infer<typeof aiConnectionInput>>
export type AiConnection = Omit<AiConnectionInput, 'id' | 'apiKey'> & { readonly id: string; readonly hasKey: boolean }
export type AiConnections = { readonly connections: readonly AiConnection[]; readonly activeId: string | null }
export type AiResult<T> = { readonly value: T } | { readonly issues: readonly { readonly path: string; readonly message: string }[] }

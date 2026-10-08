export const aiProviders = {
  openai: { name: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  anthropic: { name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1' },
  gemini: { name: 'Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  openrouter: { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1' },
  custom: { name: 'OpenAI-compatible', endpoint: 'http://localhost:11434/v1' },
} as const

export type AiProvider = keyof typeof aiProviders
export type AiConnectionInput = {
  readonly id?: string
  readonly name: string
  readonly provider: AiProvider
  readonly endpoint: string
  readonly model: string
  readonly apiKey?: string
}
export type AiConnection = Omit<AiConnectionInput, 'id' | 'apiKey'> & { readonly id: string; readonly hasKey: boolean }
export type AiConnections = { readonly connections: readonly AiConnection[]; readonly activeId: string | null }
export type AiResult<T> = { readonly value: T } | { readonly issues: readonly { readonly path: string; readonly message: string }[] }

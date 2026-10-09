import type { aiTools, AiResult } from '@nesso/ai'

export type McpState = { readonly url: string; readonly token: string; readonly running: boolean }
export type McpEvent =
  | { readonly type: 'tool'; readonly id: string; readonly name: keyof typeof aiTools; readonly input: unknown }
  | { readonly type: 'cancel'; readonly id: string }

export type McpBridge = {
  readonly getState: () => Promise<AiResult<McpState>>
  readonly setEnabled: (enabled: boolean) => Promise<AiResult<McpState>>
  readonly copyUrl: () => Promise<AiResult<true>>
  readonly copyToken: () => Promise<AiResult<true>>
  readonly regenerateAccess: () => Promise<AiResult<McpState>>
  readonly subscribeState: (listener: (state: McpState) => void) => () => void
  readonly subscribeTools: (listener: (event: McpEvent) => void) => () => void
  readonly disconnect: () => void
  readonly reply: (id: string, result: AiResult<unknown>) => void
}

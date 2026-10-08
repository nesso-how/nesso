import type { AiConnectionInput, AiConnections, AiResult } from '@nesso/ai'

export type AiBridge = {
  readonly list: () => Promise<AiResult<AiConnections>>
  readonly save: (input: AiConnectionInput) => Promise<AiResult<AiConnections>>
  readonly remove: (id: string) => Promise<AiResult<AiConnections>>
  readonly activate: (id: string) => Promise<AiResult<AiConnections>>
  readonly verify: (input: AiConnectionInput) => Promise<AiResult<true>>
  readonly models: (input: AiConnectionInput) => Promise<AiResult<readonly string[]>>
}

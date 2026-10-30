import { createAiChat } from './chat.ts'
import { host } from '../store/index.ts'
import { documentation } from './docs.ts'

export { documentation }
export const chat = window.nessoAi
  ? createAiChat(window.nessoAi, host.store, documentation)
  : undefined

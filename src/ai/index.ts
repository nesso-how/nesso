import { createAiChat } from './chat.ts'
import { host } from '../store/index.ts'

export const chat = window.nessoAi ? createAiChat(window.nessoAi, host.store) : undefined

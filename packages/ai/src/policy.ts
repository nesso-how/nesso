export const aiTextLimits = { conceptLabel: 60, relationLabel: 30, viewName: 70 } as const

export const aiChatLimits = {
  messageLength: 100_000,
  messageCount: 500,
  contextLength: 32_000,
} as const

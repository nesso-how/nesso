export const cases = {
  worker: ['desktop', 'static-web'],
  bundled: ['desktop', 'static-web'],
  startup: ['desktop'],
} as const

export type Scenario = keyof typeof cases
export type Platform = typeof cases[Scenario][number]

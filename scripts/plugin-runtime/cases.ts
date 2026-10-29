export const cases = {
  worker: ['desktop', 'static-web'],
  bundled: ['desktop', 'static-web'],
  storage: ['desktop', 'static-web'],
  startup: ['desktop'],
  installation: ['desktop'],
  'safe-plugins': ['desktop'],
  'corrupt-records': ['desktop'],
} as const

export type Scenario = keyof typeof cases
export type Platform = typeof cases[Scenario][number]

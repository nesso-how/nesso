export const cases = {
  worker: ['desktop', 'static-web'],
  panel: ['desktop', 'static-web'],
  notes: ['desktop', 'static-web'],
  'panel-workspace': ['desktop'],
  'busy-panel': ['desktop'],
  bundled: ['desktop', 'static-web'],
  images: ['desktop', 'static-web'],
  intro: ['desktop', 'static-web'],
  compact: ['desktop', 'static-web'],
  creation: ['desktop', 'static-web'],
  storage: ['desktop', 'static-web'],
  startup: ['desktop'],
  installation: ['desktop'],
  'safe-plugins': ['desktop'],
  'corrupt-records': ['desktop'],
} as const

export type Scenario = keyof typeof cases
export type Platform = (typeof cases)[Scenario][number]

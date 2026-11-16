export const appearances = ['system', 'light', 'dark'] as const

export type Appearance = (typeof appearances)[number]

export type AppearanceBridge = {
  set: (appearance: Appearance) => void
}

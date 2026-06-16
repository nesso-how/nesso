// SPDX-License-Identifier: MIT
// To add a new language:
//   1. Copy locales/en.ts → locales/<code>.ts and translate all strings.
//   2. Add it to the `locales` map in registry.ts.
//   3. Add the language code to the `Language` union in src/types/graph.ts.
import { useGraphStore } from '@/store'
import { locales } from './registry'

export type { Locale } from './registry'

export function useT() {
  const language = useGraphStore((s) => s.settings.language)
  return locales[language]
}

/** Non-reactive locale accessor for use outside React. It reads the store, so it
 *  must not be imported by a store slice that `@/store` composes (that forms an
 *  init-time import cycle); those should import `@/i18n/registry` instead. */
export function getT() {
  return locales[useGraphStore.getState().settings.language]
}

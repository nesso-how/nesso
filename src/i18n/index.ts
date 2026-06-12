// SPDX-License-Identifier: MIT
// To add a new language:
//   1. Copy locales/en.ts → locales/<code>.ts and translate all strings.
//   2. Add it to the `locales` map below.
//   3. Add the language code to the `Language` union in src/types/graph.ts.
import { useGraphStore } from '@/store'
import en from './locales/en'
import it from './locales/it'

const locales = { en, it } as const

export function useT() {
  const language = useGraphStore((s) => s.settings.language)
  return locales[language]
}

/** Non-reactive locale accessor for use outside React (e.g. store slices). */
export function getT() {
  return locales[useGraphStore.getState().settings.language]
}

export type Locale = typeof en

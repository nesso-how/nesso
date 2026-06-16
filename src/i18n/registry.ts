// SPDX-License-Identifier: MIT
import en from './locales/en'
import it from './locales/it'

/** Locale string tables, keyed by language code. Has no store dependency, so it
 *  is safe to import from store slices — unlike `@/i18n`, whose `useT`/`getT`
 *  pull in the store and would form an init-time import cycle. */
export const locales = { en, it } as const

export type Locale = typeof en

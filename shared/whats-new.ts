import { locales } from '@nesso-how/i18n'
import { z } from 'zod'

export type WhatsNewBridge = {
  startup: () => Promise<string | undefined>
}

export const releaseHighlights = z
  .record(z.enum(locales), z.array(z.string().trim().min(1)).min(1).max(3))
  .refine((notes) => locales.every((locale) => notes[locale].length === notes.en.length), {
    message: 'all languages must have the same number of highlights',
  })

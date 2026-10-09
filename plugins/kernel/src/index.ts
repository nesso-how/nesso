import type { Plugin, ThemeDefinition } from '@nesso/plugin'
import { createTranslator } from '@nesso/i18n'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }

const translate = createTranslator(en, { it })

export const kernelTheme: ThemeDefinition = {
  id: 'kernel',
}

export const kernelPlugin: Plugin = {
  kind: 'theme',
  metadata: (locale) => ({
    name: translate(locale)('pluginName'),
    description: translate(locale)('pluginDescription'),
    documentation: translate(locale)('pluginDocumentation'),
  }),
  operations: [],
  create: () => kernelTheme,
}

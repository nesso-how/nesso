# @nesso/i18n

Framework-independent translation utilities with typed keys, interpolation, plurals, and English fallback. No runtime dependencies or mutable locale state.

## Usage

```ts
import { createTranslator } from '@nesso/i18n'
import en from './en.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }

const translate = createTranslator(en, { it })
const t = translate('it')
t('greeting', { name: 'Omar' })
t('conceptCount', { count: 2 })
```

Keep JSON catalogs alongside their host or plugin. The host persists `preferences.locale`; renderers read it through the injected store. An unset locale means English. Document contents and vocabulary IRIs remain unchanged.

## API

- `createTranslator`: infer keys and message shapes from the English catalog and return a locale-bound translator with English fallback. Messages are plain strings with `{name}` placeholders, or `{ one, other }` plural forms selected by `Intl.PluralRules` using `count`.
- `locales`, `defaultLocale`, `localeNames`: supported English/Italian locales, English default, and native display names.
- `isLocale`: check whether a value is a supported locale.
- Types: `Locale`, `Message`, `Catalog`, `Translation`, `Values`; missing interpolation values or invalid counts throw `I18nError` with structured issues.

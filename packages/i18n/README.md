# @nesso/i18n

Framework-independent i18next wrapper with typed keys, interpolation, plurals, and English fallback. Each translator owns an isolated instance; locale selection never changes shared state.

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

- `createTranslator`: infer keys from the English catalog and return a locale-bound translator with English fallback. Catalogs use native i18next JSON: `{{name}}` placeholders and plural suffixes such as `conceptCount_one`/`conceptCount_other`, called as `t('conceptCount', { count })`. Include the locale's plural forms (`_many` for Italian). Bundled resources initialize synchronously; i18next handles interpolation and plural selection. Text is returned unescaped for React to render, never as HTML.
- `locales`, `defaultLocale`, `localeNames`: supported English/Italian locales, English default, and native display names.
- `isLocale`: check whether a value is a supported locale.
- Types: `Locale`, `Catalog`, `Translation`, `Values`; unknown keys, missing interpolation values or invalid counts throw `I18nError` with structured issues.

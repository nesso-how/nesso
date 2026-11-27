# @nesso-how/i18n

A framework-independent i18next wrapper with typed keys, interpolation, plurals, and English fallback. Each translator owns an isolated instance, so selecting a locale never changes shared state.

## Usage

Create `en.json`, `it.json`, and `zh-CN.json` alongside your host or plugin:

`en.json`:

```json
{
  "greeting": "Hello, {{name}}",
  "conceptCount_one": "{{count}} concept",
  "conceptCount_other": "{{count}} concepts"
}
```

`it.json`:

```json
{
  "greeting": "Ciao, {{name}}",
  "conceptCount_one": "{{count}} concetto",
  "conceptCount_many": "{{count}} concetti",
  "conceptCount_other": "{{count}} concetti"
}
```

`zh-CN.json`:

```json
{
  "greeting": "你好，{{name}}",
  "conceptCount_other": "{{count}} 个概念"
}
```

```ts
import { createTranslator } from '@nesso-how/i18n'
import en from './en.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }
import zhCN from './zh-CN.json' with { type: 'json' }

const translate = createTranslator(en, { it, 'zh-CN': zhCN })
const t = translate('it')
console.log(t('greeting', { name: 'Omar' }))
console.log(t('conceptCount', { count: 2 }))
```

Catalogs use native i18next JSON, with placeholders like `{{name}}` and plural suffixes such as `_one` and `_other`. Italian also needs `_many`, while Simplified Chinese uses only `_other` for every count. Call a plural message by its base key with a finite `count`. Bundled resources initialize synchronously, and i18next handles interpolation and plural selection.

The host uses the saved `preferences.locale` when there is one. Otherwise it detects a supported locale from `navigator.languages`, falls back to English if none matches, and persists the choice. Plugins read the locale and subscribe to it through their injected store.

Translate interface text, but leave document contents and vocabulary IRIs untranslated. Vocabulary plugins may supply localized display labels for relations in their definitions, and these labels do not replace the labels stored in the document.

## API

Use `@nesso-how/i18n/locale` for locale utilities without loading i18next.

- `createTranslator`: infer base keys from the English catalog and return a locale-bound translator with English fallback.
- `locales`, `defaultLocale`, `localeNames`: the supported locales (English, Italian, and Simplified Chinese as `zh-CN`), the English default, and native display names.
- `isLocale`: check whether a value is a supported locale.
- `detectLocale(languages)`: find the first supported language in an ordered list of BCP 47 tags, or fall back to English. Regional variants and Simplified Chinese scripts match, but Traditional Chinese does not match Simplified Chinese.

Unknown keys, missing interpolation values, and invalid plural counts throw `I18nError` with structured `issues`. Returned strings are unescaped, so render them as text and never as HTML. See [src/index.ts](src/index.ts) for signatures and types.

## Build

`pnpm --filter @nesso-how/i18n build`

Vite uses the TypeScript sources, while Node and Electron use the compiled JavaScript. The AI package builds this dependency automatically.

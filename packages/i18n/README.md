# @nesso/i18n

Framework-independent i18next wrapper with typed keys, interpolation, plurals, and English fallback. Each translator owns an isolated instance; locale selection never changes shared state.

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
import { createTranslator } from '@nesso/i18n'
import en from './en.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }
import zhCN from './zh-CN.json' with { type: 'json' }

const translate = createTranslator(en, { it, 'zh-CN': zhCN })
const t = translate('it')
console.log(t('greeting', { name: 'Omar' }))
console.log(t('conceptCount', { count: 2 }))
```

Catalogs use native i18next JSON: `{{name}}` placeholders and plural suffixes such as `_one`/`_other`, plus `_many` for Italian. Simplified Chinese uses only `_other` for every count. Call plural messages by their base key with a finite `count`. Bundled resources initialize synchronously; i18next handles interpolation and plural selection.

The host uses a saved `preferences.locale` when available; otherwise it detects a supported locale from `navigator.languages`, falling back to English, and persists the choice. Plugins read and subscribe through their injected store. Translate interface text, not document contents or vocabulary IRIs.

## API

Use `@nesso/i18n/locale` for locale utilities without loading i18next.

- `createTranslator`: infer base keys from the English catalog and return a locale-bound translator with English fallback.
- `locales`, `defaultLocale`, `localeNames`: supported English, Italian, and Simplified Chinese (`zh-CN`) locales, English default, and native display names.
- `isLocale`: check whether a value is a supported locale.
- `detectLocale(languages)`: find the first supported language in an ordered list of BCP 47 tags, matching regional variants and Simplified Chinese scripts, with English fallback. Traditional Chinese does not match Simplified Chinese.

Unknown keys, missing interpolation values, and invalid plural counts throw `I18nError` with structured `issues`. Returned strings are unescaped: render them as text, never as HTML. See [src/index.ts](src/index.ts) for signatures and types.

## Build

`pnpm --filter @nesso/i18n build`

Vite uses TypeScript sources; Node and Electron use compiled JavaScript. The AI package builds this dependency automatically.

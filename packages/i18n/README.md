# @nesso/i18n

Framework-independent i18next wrapper with typed keys, interpolation, plurals, and English fallback. Each translator owns an isolated instance; locale selection never changes shared state.

## Usage

Create `en.json` and `it.json` alongside your host or plugin:

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

```ts
import { createTranslator } from '@nesso/i18n'
import en from './en.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }

const translate = createTranslator(en, { it })
const t = translate('it')
console.log(t('greeting', { name: 'Omar' }))
console.log(t('conceptCount', { count: 2 }))
```

Catalogs use native i18next JSON: `{{name}}` placeholders and plural suffixes such as `_one`/`_other`, plus `_many` for Italian. Call plural messages by their base key with a finite `count`. Bundled resources initialize synchronously; i18next handles interpolation and plural selection.

The host persists `preferences.locale`, defaulting to English; plugins read and subscribe through their injected store. Translate interface text, not document contents or vocabulary IRIs.

## API

- `createTranslator`: infer base keys from the English catalog and return a locale-bound translator with English fallback.
- `locales`, `defaultLocale`, `localeNames`: supported English/Italian locales, English default, and native display names.
- `isLocale`: check whether a value is a supported locale.

Unknown keys, missing interpolation values, and invalid plural counts throw `I18nError` with structured `issues`. Returned strings are unescaped: render them as text, never as HTML. See [src/index.ts](src/index.ts) for signatures and types.

## Build

`pnpm --filter @nesso/i18n build`

Vite uses TypeScript sources; Node and Electron use compiled JavaScript. The AI package builds this dependency automatically.

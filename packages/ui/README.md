# @nesso/ui

Reusable React primitives and shared styles. Base UI-backed controls use Nesso's semantic theme tokens; graph components and app layout remain outside this package.

## Usage

```tsx
import { Banner } from '@nesso/ui'

export function SaveWarning() {
  return <Banner tone="warning">Some changes couldn't be saved locally.</Banner>
}
```

Import `@nesso/ui/styles.css` after Tailwind in the host stylesheet. The host supplies the theme tokens and fonts. React and React DOM are peers.

## API

- `Button`: default, outline, and ghost variants; text and icon sizes.
- `Input`, `Label`: shared form primitives.
- `Menu`, `MenuItem`, `MenuPopup`, `MenuRadioItem`: Base UI menu parts, styled items/popup, and radio choices.
- `Combobox`, `ComboboxItem`, `ComboboxPopup`: Base UI searchable selection parts and styled items/popup.
- `Autocomplete`, `AutocompleteClear`, `AutocompleteItem`, `AutocompletePopup`: Base UI text suggestion parts with styled clear control, items, and popup; filtering and saving remain caller-owned.
- `Collapsible`: Base UI disclosure parts.
- `SectionHeading`: controlled disclosure heading with chevron, `aria-expanded`, and transparent hover/active backgrounds; open state remains caller-owned.
- `Dialog`, `DialogPopup`: Base UI dialog parts and styled popup/backdrop.
- `Banner`: inline strip messages; `info` (default) uses a polite status, while `warning` and `error` use alerts. Content, actions, dismissal, and disclosure remain caller-owned.
- `ToastViewport`: floating bottom-center info, warning, and request toasts. Info auto-dismisses with a pausable timer; warnings and requests persist until acted upon. Queueing, timers, and content remain caller-owned.
- `ResizeHandle`, `ResizableHandle`, `ResizablePanel`, `ResizablePanelGroup`: panel layout primitives.
- `styles.css`: semantic token mappings, shared interaction states, touch targets, and reduced-motion styles.

See [src/index.ts](src/index.ts) for all component exports.

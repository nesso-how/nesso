# Nesso UI

React components styled for Nesso, including buttons, forms, menus, dialogs, and panels. Many controls build on [Base UI](https://base-ui.com/). The package depends on Nesso's theme tokens; it does not include a standalone theme.

## Install

```sh
npm install @nesso-how/ui@alpha
```

Requires React and React DOM `^19.2.8`. The package follows Nesso's app version; test against the app versions you support rather than assuming compatibility from matching version numbers.

## Use in a Nesso plugin

Nesso supplies React, component styles, and theme tokens inside plugin UI panels. No package stylesheet import is needed:

```tsx
import { Button } from '@nesso-how/ui'

export function PluginUI() {
  return <Button>Hello</Button>
}
```

Keep React and React DOM external in your plugin bundle. Import your own layout CSS normally; Nesso does not compile arbitrary Tailwind classes from plugin source. Start with the [standalone plugin example](https://github.com/nesso-how/nesso/tree/main/packages/plugin/example) and see the [SDK UI contract](https://github.com/nesso-how/nesso/blob/main/packages/plugin/README.md#action-ui) for setup and permissions.

## Use outside Nesso

Install React/React DOM and configure [Tailwind CSS 4](https://tailwindcss.com/docs/installation) in your application. Import the package's source CSS after Tailwind in your main stylesheet:

```css
@import 'tailwindcss';
@import '@nesso-how/ui/styles.css';
```

Your build must compile this CSS; it is not a precompiled stylesheet. Supply the theme CSS variables on your document or component container: colors such as `--background`, `--foreground`, and `--border`; `--font-sans` and `--font-mono`; `--radius-control` and `--radius-object` with length units; and `--duration-state` with time units. No theme values or font files are included. See the [theme schema](https://github.com/nesso-how/nesso/blob/main/packages/plugin/src/definitions.ts) for all color tokens and [Paper's theme](https://github.com/nesso-how/nesso/blob/main/plugins/paper-theme/src/index.ts) for example values.

## Components

| Area                   | Exports                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Buttons and inputs     | `Button`, `IconButton`, `Input`, `DirectoryField`, `MarkdownInput`, `Label`, `PreferenceSelect`, `ColorPicker`            |
| Forms and rows         | `Field`, `FieldHint`, `ListRow`, `ListRowButton`, `ListRowDetail`, `ListRowTitle`, `RevealActions`, `PromptForm`          |
| Menus and popovers     | `Menu`, `MenuItem`, `MenuPopup`, `MenuRadioItem`, `Popover`, `PopoverPopup`                                               |
| Search and suggestions | `Combobox`, `ComboboxItem`, `ComboboxPopup`, `Autocomplete`, `AutocompleteClear`, `AutocompleteItem`, `AutocompletePopup` |
| Dialogs                | `Dialog`, `DialogActions`, `DialogPopup`, `ConfirmDialog`, `TextPromptDialog`, `BottomSheet`                              |
| Panels and disclosure  | `SidePanel`, `PanelHeader`, `PluginPage`, `PluginContent`, `SectionHeading`, `Collapsible`, `Tabs`                        |
| Feedback               | `Banner`, `BannerRow`, `BannerDetails`, `ToastViewport`, `Spinner`                                                        |
| Labels and icons       | `Kbd`, `ContextLabel`, `ActionIcon`                                                                                       |

`Button` supports `default`, `outline`, and `ghost` variants. `SidePanel` supports controlled resizing and collapse. `Spinner` accepts an accessible `label` and respects reduced motion. State, content, and event handling remain yours to provide.

`BottomSheet` is a controlled, non-modal drawer with a title, close label, optional footer, and popup ref for measuring covered content. It supports swipe-down dismissal, safe-area padding, and reduced motion. Reading text can use `--nesso-reading-font-size` and `--nesso-reading-line-height`, which increase from 13/20px to 15/23px on narrow screens or coarse pointers.

`MarkdownInput` accepts Markdown through `value`/`onChange`, with live preview of emphasis, inline code, links, and lists. Syntax reappears around the selection. Cmd/Ctrl+B/I/E toggles bold, italic, and inline code; Enter continues or exits lists, Tab/Shift+Tab changes nesting, and Shift+Enter inserts a line break. Optional `tasks` enables clickable task checkboxes; `placeholder` appears when empty.

Undo/redo is local by default. Use `history={false}` for host-owned history or `history="focus"` to reset local history on blur and external value changes. Exhausted local history never falls through. Menu commands can send `beforeinput` events (`historyUndo`/`historyRedo`) to the focused editor inside `[data-local-history]`.

Cmd/Ctrl-click calls `onOpenLink`; read-only fields use a regular click. The host validates and opens destinations.

The package also exports `useMediaQuery`, `contrastColor`, `presetColors`, and the `ActionIconName` and `ToastItem` types. See the [public exports](https://github.com/nesso-how/nesso/blob/main/packages/ui/src/index.ts) and component source files for prop definitions; published TypeScript declarations provide editor completion.

# Nesso UI

React components styled for Nesso, including buttons, forms, menus, dialogs, and panels. Many controls build on [Base UI](https://base-ui.com/). The package depends on Nesso's theme tokens and does not include a standalone theme.

## Install

```sh
npm install @nesso-how/ui
```

Requires React and React DOM `^19.2.8`. The package version follows Nesso's app version, but matching version numbers do not guarantee compatibility, so test against the app versions you support.

## Use in a Nesso plugin

Inside plugin UI panels, Nesso supplies React, component styles, and theme tokens. You do not need to import a package stylesheet:

```tsx
import { Button } from '@nesso-how/ui'

export function PluginUI() {
  return <Button>Hello</Button>
}
```

Keep React and React DOM external in your plugin bundle. You can import your own layout CSS as usual, but Nesso does not compile arbitrary Tailwind classes from plugin source. Start with the [standalone plugin example](https://github.com/nesso-how/nesso/tree/main/packages/plugin/example), and see the [SDK UI contract](https://github.com/nesso-how/nesso/blob/main/packages/plugin/README.md#action-ui) for setup and permissions.

## Use outside Nesso

Install React and React DOM, and configure [Tailwind CSS 4](https://tailwindcss.com/docs/installation) in your application. In your main stylesheet, import the package's source CSS after Tailwind:

```css
@import 'tailwindcss';
@import '@nesso-how/ui/styles.css';
```

This is source CSS, not a precompiled stylesheet, so your build must compile it. Supply these theme CSS variables on your document or component container:

- Colors such as `--background`, `--foreground`, and `--border`.
- `--font-sans` and `--font-mono`.
- `--radius-control` and `--radius-object`, with length units.
- `--duration-state`, with time units.

The package includes no theme values or font files. See the [theme schema](https://github.com/nesso-how/nesso/blob/main/packages/plugin/src/definitions.ts) for all color tokens and [Paper's theme](https://github.com/nesso-how/nesso/blob/main/plugins/paper-theme/src/index.ts) for example values.

## Components

| Area                   | Exports                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Buttons and inputs     | `Button`, `IconButton`, `Input`, `DirectoryField`, `MarkdownInput`, `Label`, `PreferenceSelect`, `ColorPicker`            |
| Forms and rows         | `Field`, `FieldHint`, `ListRow`, `ListRowButton`, `ListRowDetail`, `ListRowTitle`, `RevealActions`, `PromptForm`          |
| Menus and popovers     | `Menu`, `MenuItem`, `MenuPopup`, `MenuRadioItem`, `MenuSubmenuTrigger`, `Popover`, `PopoverPopup`                         |
| Search and suggestions | `Combobox`, `ComboboxItem`, `ComboboxPopup`, `Autocomplete`, `AutocompleteClear`, `AutocompleteItem`, `AutocompletePopup` |
| Dialogs                | `Dialog`, `DialogActions`, `DialogPopup`, `ConfirmDialog`, `TextPromptDialog`, `BottomSheet`                              |
| Panels and disclosure  | `SidePanel`, `PanelHeader`, `PluginPage`, `PluginContent`, `SectionHeading`, `Collapsible`, `Tabs`                        |
| Feedback               | `Banner`, `BannerRow`, `BannerDetails`, `ToastViewport`, `Spinner`, `CharacterLimitHint`                                  |
| Labels and icons       | `Kbd`, `ContextLabel`, `ActionIcon`                                                                                       |

Components leave state, content, and event handling to you. Some have options worth knowing:

- `Button` supports `default`, `outline`, and `ghost` variants.
- `SidePanel` supports controlled resizing and collapse.
- `Spinner` accepts an accessible `label` and respects reduced motion.
- `MenuPopup` accepts a preferred `side`.
- `MenuSubmenuTrigger` goes inside `Menu.SubmenuRoot`.

`BottomSheet` is a controlled, non-modal drawer with a title, a close label, an optional footer, and a popup ref for measuring covered content. It supports swipe-down dismissal, safe-area padding, and reduced motion. Reading text can use `--nesso-reading-font-size` and `--nesso-reading-line-height`, which grow from 13/20px to 15/23px on narrow screens or with coarse pointers.

`MarkdownInput` takes Markdown through `value` and `onChange` and shows a live preview of emphasis, inline code, links, and lists, with the syntax reappearing around the selection. Cmd/Ctrl+B/I/E toggles bold, italic, and inline code, Enter continues or exits lists, Tab/Shift+Tab changes nesting, and Shift+Enter inserts a line break. The optional `tasks` prop enables clickable task checkboxes, and `placeholder` appears when the field is empty.

Pass localized `toolbar` labels (`label`, `bold`, `italic`, `code`, `bullet`, `numbered`, and `task`) to show formatting controls above editable text. Inline formatting applies to the selection, or to the whole word when the caret sits strictly inside one. If you apply bold, italic, or inline code to a mixed selection, spans of the same format merge wherever Markdown supports a single span. Inline code shows other formatting markers literally. Cmd/Ctrl+Shift+8/7/9 toggles bulleted, numbered, and task lists on the selected lines, although the task control and its shortcut require `tasks`.

Use `compactToolbar` for 12 px icons and 24 px buttons with a mouse or trackpad, while devices with a coarse pointer still get 40 px touch targets. Read-only fields hide the toolbar unless you set `readOnlyToolbar`, which keeps it visible with its formatting buttons disabled. The optional `toolbarEnd` renders a control you provide at the end of the visible toolbar, outside the formatting group.

Undo and redo are local by default. Use `history={false}` when the host owns history, or `history="focus"` to reset local history on blur and on external value changes. When local history runs out, undo and redo stop there and never reach the document history. Menu commands can send `beforeinput` events (`historyUndo`/`historyRedo`) to the focused editor inside `[data-local-history]`.

Cmd/Ctrl-click calls `onOpenLink`, and in read-only fields a regular click does the same. The host validates and opens destinations.

The package also exports `useMediaQuery`, `conceptColor`, and the `ActionIconName` and `ToastItem` types. For prop definitions, see the [public exports](https://github.com/nesso-how/nesso/blob/main/packages/ui/src/index.ts) and the component source files. The published TypeScript declarations provide editor completion.

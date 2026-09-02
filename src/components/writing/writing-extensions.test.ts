// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { SuggestionPluginKey } from '@tiptap/suggestion'
import { afterEach, describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en'
import { SlashCommand, positionSlashPopup, slashMenuItems } from './extensions/slashCommand'
import { Callout } from './extensions/callout'
import { Example } from './extensions/example'

function makeEditor(content: string | object = '<p>base</p>') {
  return new Editor({ extensions: [StarterKit, Callout, Example], content: content as never })
}

describe('custom snippet nodes', () => {
  it('wraps content in a callout and round-trips through JSON verbatim', () => {
    const editor = makeEditor()
    editor.commands.selectAll()
    editor.commands.setCallout()
    const json = editor.getJSON()
    expect(json.content?.[0]?.type).toBe('callout')
    const again = makeEditor(json)
    expect(again.getJSON()).toEqual(json)
    editor.destroy()
    again.destroy()
  })

  it('exposes setExample and round-trips an example block verbatim', () => {
    const editor = makeEditor()
    editor.commands.focus('end')
    editor.commands.insertContent('<p>worked example</p>')
    editor.commands.setExample()
    const json = editor.getJSON()
    expect(json.content?.some((n) => n.type === 'example')).toBe(true)
    const again = makeEditor(json)
    expect(again.getJSON()).toEqual(json)
    expect(typeof editor.commands.setCallout).toBe('function')
    expect(typeof editor.commands.setExample).toBe('function')
    editor.destroy()
    again.destroy()
  })
})

describe('note mark schema', () => {
  it('matches the marks exposed by the configured StarterKit', () => {
    const editor = makeEditor()
    expect(Object.keys(editor.schema.marks).sort()).toEqual(
      ['bold', 'code', 'italic', 'link', 'strike', 'underline'].sort(),
    )
    editor.destroy()
  })
})

describe('slashMenuItems', () => {
  it('uses the configured snippet strings for labels and filters by label or id', () => {
    const strings = { ...en.writing.snippets, callout: 'Nota evidenziata' }
    expect(slashMenuItems(strings, '').find((s) => s.id === 'callout')?.label).toBe(
      'Nota evidenziata',
    )
    expect(slashMenuItems(strings, 'eviden').map((s) => s.id)).toEqual(['callout'])
    expect(slashMenuItems(en.writing.snippets, 'head').map((s) => s.id)).toEqual([
      'heading-2',
      'heading-3',
    ])
    expect(slashMenuItems(en.writing.snippets, 'callout').map((s) => s.id)).toEqual(['callout'])
  })
})

describe('SlashCommand options contract', () => {
  it('accepts configured snippet strings and defaults to unset (locale at open time)', () => {
    const configured = SlashCommand.configure({ snippets: en.writing.snippets })
    expect(configured.options.snippets).toEqual(en.writing.snippets)
    expect(SlashCommand.options.snippets).toBeUndefined()
  })
})

describe('SlashCommand Escape + popup lifecycle contract', () => {
  function makeSlashEditor() {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Callout,
        Example,
        SlashCommand.configure({ snippets: en.writing.snippets }),
      ],
      content: '<p></p>',
    })
    editor.commands.focus('end')
    return editor
  }

  const escapeOn = (editor: Editor) => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    editor.view.dom.dispatchEvent(event)
    return event
  }

  it('exits the suggestion plugin on Escape and closes the popup', () => {
    const editor = makeSlashEditor()
    expect(SuggestionPluginKey.getState(editor.state)?.active).toBe(false)
    editor.commands.insertContent('/')
    expect(SuggestionPluginKey.getState(editor.state)?.active).toBe(true)
    const event = escapeOn(editor)
    expect(event.defaultPrevented).toBe(true)
    expect(SuggestionPluginKey.getState(editor.state)?.active).toBe(false)
    editor.destroy()
  })

  it('resets the popup state when the editor is destroyed while the popup is open', () => {
    const editor = makeSlashEditor()
    editor.commands.insertContent('/')
    expect(SuggestionPluginKey.getState(editor.state)?.active).toBe(true)
    editor.destroy()
  })

  it('exits suggestion state when Escape starts on the popup container', async () => {
    const editor = makeSlashEditor()
    editor.commands.insertContent('/')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const popup = document.querySelector<HTMLElement>('[data-writing-slash-popup]')
    expect(popup).not.toBeNull()

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    popup!.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(SuggestionPluginKey.getState(editor.state)?.active).toBe(false)
    editor.destroy()
  })

  it('repositions on resize and capture-phase scroll, then removes both listeners', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const editor = makeSlashEditor()
    let destroyed = false
    try {
      editor.commands.insertContent('/')
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const popup = [...document.body.children].find(
        (child): child is HTMLDivElement =>
          child instanceof HTMLDivElement && child.style.position === 'fixed',
      )
      if (popup === null || popup === undefined) throw new Error('popup not rendered')
      const measure = vi.spyOn(popup, 'getBoundingClientRect')

      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('scroll'))

      expect(measure).toHaveBeenCalledTimes(2)
      editor.destroy()
      destroyed = true
      expect(add).toHaveBeenCalledWith('resize', expect.any(Function))
      expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), true)
      expect(add).toHaveBeenCalledWith('keydown', expect.any(Function), true)
      expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
      expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
      expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true)
    } finally {
      if (!destroyed) editor.destroy()
      vi.restoreAllMocks()
    }
  })

  // Popup focus restoration requires a mounted EditorContent and is covered at
  // WritingMode level in WritingMode.test.tsx.
})

describe('SlashCommand popup viewport positioning', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const caretRect = (top: number, bottom: number): DOMRect => ({
    x: 24,
    y: top,
    width: 0,
    height: bottom - top,
    top,
    right: 24,
    bottom,
    left: 24,
    toJSON: () => ({}),
  })

  const popupRect = (height: number): DOMRect => ({
    x: 0,
    y: 0,
    width: 220,
    height,
    top: 0,
    right: 220,
    bottom: height,
    left: 0,
    toJSON: () => ({}),
  })

  function expectPopupBelow(popup: HTMLDivElement) {
    expect(popup.style.top).toBe('126px')
    expect(popup.style.transform).toBe('')
    expect(popup.style.maxHeight).toBe('474px')
    expect(popup.style.overflowY).toBe('auto')
  }

  it('positions below the caret and constrains the popup to the remaining viewport', () => {
    const popup = document.createElement('div')
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600)
    vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue(popupRect(120))

    positionSlashPopup(popup, caretRect(100, 120))

    expect(popup.style.left).toBe('24px')
    expectPopupBelow(popup)
  })

  it('flips above a tall popup and clears the flip when it fits below again', () => {
    const popup = document.createElement('div')
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600)
    vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue(popupRect(200))

    positionSlashPopup(popup, caretRect(520, 560))

    expect(popup.style.top).toBe('514px')
    expect(popup.style.transform).toBe('translateY(-100%)')
    expect(popup.style.maxHeight).toBe('514px')
    expect(popup.style.overflowY).toBe('auto')

    positionSlashPopup(popup, caretRect(100, 120))

    expectPopupBelow(popup)
  })

  it('clamps the popup horizontally to the viewport', () => {
    const popup = document.createElement('div')
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600)
    vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue({
      ...popupRect(120),
      left: 0,
      right: 220,
      width: 220,
    })

    positionSlashPopup(popup, { ...caretRect(100, 120), left: 760, right: 760 })

    expect(popup.style.left).toBe('580px')
  })
})

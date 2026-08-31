// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { SlashCommand, slashMenuItems } from './extensions/slashCommand'
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

// SPDX-License-Identifier: MIT
import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    example: {
      setExample: () => ReturnType
      unsetExample: () => ReturnType
    }
  }
}

/** Example block — worked-example box persisted verbatim in notes. */
export const Example = Node.create({
  name: 'example',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-example]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-example': '', class: 'writing-example' }),
      0,
    ]
  },

  addCommands() {
    return {
      setExample:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      unsetExample:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    }
  },
})

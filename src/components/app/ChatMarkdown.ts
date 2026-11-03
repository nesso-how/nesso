import { createElement, memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { isAllowedExternalLink } from '../../../shared/link-policy.ts'

const disallowedElements = ['img']
const urlTransform = (url: string) => (isAllowedExternalLink(url) ? url : '')
const components: Components = {
  a: ({ href, children }) =>
    href
      ? createElement('a', { href, target: '_blank', rel: 'noopener noreferrer' }, children)
      : createElement('span', null, children),
}

export const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  return createElement(
    'div',
    { className: 'chat-markdown' },
    createElement(
      Markdown,
      { skipHtml: true, disallowedElements, urlTransform, components },
      content,
    ),
  )
})

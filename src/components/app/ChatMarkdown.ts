import { createElement, memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { isAllowedExternalLink } from '../../../shared/link-policy.ts'

const disallowedElements = ['img']
const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeHighlight]
const urlTransform = (url: string) => (isAllowedExternalLink(url) ? url : '')
const components: Components = {
  a: ({ href, children }) =>
    href
      ? createElement('a', { href, target: '_blank', rel: 'noopener noreferrer' }, children)
      : createElement('span', null, children),
  table: ({ children }) =>
    createElement(
      'div',
      { className: 'chat-markdown-table', tabIndex: 0 },
      createElement('table', null, children),
    ),
}

export const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  return createElement(
    'div',
    { className: 'chat-markdown' },
    createElement(
      Markdown,
      {
        skipHtml: true,
        disallowedElements,
        urlTransform,
        components,
        remarkPlugins,
        rehypePlugins,
      },
      content,
    ),
  )
})

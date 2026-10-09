import { createElement } from 'react'
import Markdown from 'react-markdown'
import { isAllowedExternalLink } from '../../../shared/link-policy.ts'

export function ChatMarkdown({ content }: { content: string }) {
  return createElement('div', { className: 'chat-markdown' }, createElement(Markdown, {
    skipHtml: true,
    disallowedElements: ['img'],
    urlTransform: (url) => isAllowedExternalLink(url) ? url : '',
    components: {
      a: ({ href, children }) => href
        ? createElement('a', { href, target: '_blank', rel: 'noopener noreferrer' }, children)
        : createElement('span', null, children),
    },
  }, content))
}

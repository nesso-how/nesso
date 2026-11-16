import type { WebContents } from 'electron'

export function onDocumentNavigation(contents: WebContents, listener: () => void) {
  const navigating = (details: { isMainFrame: boolean; isSameDocument: boolean }) => {
    if (details.isMainFrame && !details.isSameDocument) listener()
  }
  contents.on('did-start-navigation', navigating)
  return () => {
    contents.removeListener('did-start-navigation', navigating)
  }
}

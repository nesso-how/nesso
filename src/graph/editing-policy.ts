export type EditingContext = {
  blocked: boolean
  nativeEditing: boolean
  documentEditing: boolean
}

export function historyTarget(context: EditingContext): 'document' | 'native' | 'none' {
  if (context.nativeEditing && (context.blocked || !context.documentEditing)) return 'native'
  return context.blocked ? 'none' : 'document'
}

export function historyShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey'>,
): 'undo' | 'redo' | undefined {
  if (!(event.metaKey || event.ctrlKey)) return
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && event.ctrlKey && !event.metaKey) return 'redo'
}

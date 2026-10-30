import { useEffect, useState, useSyncExternalStore } from 'react'
import { IconButton, PanelHeader, Tabs } from '@nesso-how/ui'
import { SquarePen, X } from 'lucide-react'
import type { createAiChat } from '@/ai/chat'
import { host, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { Inspector } from './Inspector'
import { Chat } from './Chat'

export function AssistantPanel({
  chat,
  onClose,
  onOpenSettings,
  settingsOpen = false,
  store = host.store,
  readonly = false,
}: {
  chat: ReturnType<typeof createAiChat>
  onClose?: () => void
  onOpenSettings?: () => void
  settingsOpen?: boolean
  store?: HostStore
  readonly?: boolean
}) {
  const t = useTranslation(store)
  const selected = useNessoStore((state) => state.selected.length > 0, store)
  const tab = useNessoStore((state) => state.preferences.inspectorTab ?? 'details', store)
  const [draft, setDraft] = useState('')
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const busy = useSyncExternalStore(chat.subscribe, chat.getSnapshot).phase !== 'idle'
  useEffect(() => {
    if (readonly || tab !== 'chat' || settingsOpen || !window.nessoAi) return
    let mounted = true
    void window.nessoAi
      .list()
      .then((result) => {
        if (!mounted || 'issues' in result) return
        const active = result.value.connections.find((entry) => entry.id === result.value.activeId)
        setActiveModel(active ? `${active.name} · ${active.model}` : null)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [tab, settingsOpen, busy, readonly])
  return (
    <Tabs.Root
      value={tab}
      onValueChange={(value) =>
        store.applyOperations([{ kind: 'preferences.inspectorTab', value: value as typeof tab }])
      }
      className="flex h-full min-h-0 flex-col"
    >
      <PanelHeader
        actions={
          <>
            {tab === 'chat' && (
              <IconButton
                disabled={readonly}
                aria-label={t('aiNewChat')}
                title={t('aiNewChat')}
                onClick={() => {
                  chat.clear()
                  setDraft('')
                }}
              >
                <SquarePen />
              </IconButton>
            )}
            <IconButton
              disabled={readonly || !onClose}
              aria-label={t('collapseDetails')}
              title={t('collapseDetails')}
              onClick={onClose}
            >
              <X />
            </IconButton>
          </>
        }
      >
        <Tabs.List aria-label={t('aiInspectorTabs')} className="assistant-tabs">
          <Tabs.Tab value="details">
            {t('details')}
            {selected && <span className="assistant-selection-dot" aria-hidden="true" />}
          </Tabs.Tab>
          <Tabs.Tab value="chat">{t('chat')}</Tabs.Tab>
        </Tabs.List>
      </PanelHeader>
      <Tabs.Panel value="details" className="min-h-0 flex-1">
        <Inspector store={store} readonly={readonly} />
      </Tabs.Panel>
      <Tabs.Panel value="chat" keepMounted className="min-h-0 flex-1 data-[hidden]:hidden">
        <Chat
          chat={chat}
          store={store}
          readonly={readonly}
          draft={draft}
          onDraftChange={setDraft}
          onOpenSettings={onOpenSettings}
          activeModel={activeModel}
        />
      </Tabs.Panel>
    </Tabs.Root>
  )
}

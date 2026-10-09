import { useEffect, useState } from 'react'
import { IconButton, Tabs } from '@nesso/ui'
import { SquarePen, X } from 'lucide-react'
import type { createAiChat } from '@/ai/chat'
import { useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'
import { Inspector } from './Inspector'
import { Chat } from './Chat'

export function AssistantPanel({ chat, onClose, onOpenSettings, settingsOpen }: {
  chat: ReturnType<typeof createAiChat>
  onClose: () => void
  onOpenSettings: () => void
  settingsOpen: boolean
}) {
  const t = useTranslation()
  const selected = useNessoStore((state) => state.selected.length > 0)
  const [tab, setTab] = useState<'chat' | 'details'>('chat')
  const [draft, setDraft] = useState('')
  const [activeModel, setActiveModel] = useState<string | null>(null)
  useEffect(() => {
    if (tab !== 'chat' || settingsOpen || !window.nessoAi) return
    let mounted = true
    const load = () => {
      void window.nessoAi!.list().then((result) => {
        if (!mounted || 'issues' in result) return
        const active = result.value.connections.find((entry) => entry.id === result.value.activeId)
        setActiveModel(active ? `${active.name} · ${active.model}` : null)
      }).catch(() => {})
    }
    load()
    window.addEventListener('focus', load)
    return () => { mounted = false; window.removeEventListener('focus', load) }
  }, [tab, settingsOpen])
  return (
    <Tabs.Root value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="flex h-full min-h-0 flex-col">
      <header className="assistant-header">
        <Tabs.List aria-label={t('aiInspectorTabs')} className="assistant-tabs">
          <Tabs.Tab value="chat">{t('chat')}</Tabs.Tab>
          <Tabs.Tab value="details">{t('details')}{selected && <span className="assistant-selection-dot" aria-hidden="true" />}</Tabs.Tab>
        </Tabs.List>
        <div className="assistant-actions">
          {tab === 'chat' && <IconButton aria-label={t('aiNewChat')} title={t('aiNewChat')} onClick={() => { chat.clear(); setDraft('') }}><SquarePen /></IconButton>}
          <IconButton aria-label={t('collapseDetails')} title={t('collapseDetails')} onClick={onClose}><X /></IconButton>
        </div>
      </header>
      <Tabs.Panel value="chat" keepMounted className="min-h-0 flex-1 data-[hidden]:hidden"><Chat chat={chat} draft={draft} onDraftChange={setDraft} onOpenSettings={onOpenSettings} activeModel={activeModel} /></Tabs.Panel>
      <Tabs.Panel value="details" className="min-h-0 flex-1"><Inspector /></Tabs.Panel>
    </Tabs.Root>
  )
}

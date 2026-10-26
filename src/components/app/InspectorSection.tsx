import { Collapsible, SectionHeading } from '@nesso-how/ui'
import type { ReactNode } from 'react'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import type { SectionId } from '@nesso-how/plugin'

export function InspectorSection({ store = nessoStore, id, title, children, onOpenChange }: {
  store?: HostStore
  id: SectionId
  title: string
  children: ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  const open = useNessoStore((state) => !state.preferences.collapsedSections?.includes(id), store)
  return (
    <Collapsible.Root open={open} onOpenChange={(next) => {
      store.setSectionOpen(id, next)
      onOpenChange?.(next)
    }} render={<section />}>
      <h2>
        <Collapsible.Trigger render={(props, state) => (
          <SectionHeading {...props} open={state.open} className="px-0">{title}</SectionHeading>
        )} />
      </h2>
      <Collapsible.Panel>{children}</Collapsible.Panel>
    </Collapsible.Root>
  )
}

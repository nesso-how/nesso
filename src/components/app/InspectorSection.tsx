import { Collapsible } from '@nesso/ui'
import type { ReactNode } from 'react'
import { host, useNessoStore } from '@/store'
import type { SectionId } from '@/store/types'
import { SectionHeading } from './SectionHeading'

export function InspectorSection({ id, title, children, onOpenChange }: {
  id: SectionId
  title: string
  children: ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  const open = useNessoStore((state) => !state.preferences.collapsedSections?.includes(id))
  return (
    <Collapsible.Root open={open} onOpenChange={(next) => {
      host.ui.setSectionOpen(id, next)
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

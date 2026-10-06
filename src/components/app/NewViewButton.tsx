import { useState, type Ref } from 'react'
import { LayersPlus } from 'lucide-react'
import { Button, Dialog, DialogPopup } from '@nesso/ui'
import { host, useNessoStore } from '@/store'
import { ViewNameForm } from './ViewNameForm'

export function NewViewButton({ iconOnly = false, ref }: { iconOnly?: boolean; ref?: Ref<HTMLButtonElement> }) {
  const selected = useNessoStore((state) => state.selected)
  const [open, setOpen] = useState(false)
  const [conceptIds, setConceptIds] = useState<readonly string[]>([])

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        setConceptIds(selected?.kind === 'concept' ? [selected.id] : [])
      }
      setOpen(nextOpen)
    }}>
      <Dialog.Trigger ref={ref} render={<Button
        variant="ghost"
        size={iconOnly ? 'icon-sm' : 'default'}
        className={iconOnly ? undefined : 'mb-3 w-full justify-start'}
        aria-label="New view"
        title={iconOnly ? 'New view' : undefined}
      />}>
        <LayersPlus />
        {!iconOnly && 'New view'}
      </Dialog.Trigger>
      <DialogPopup>
        <Dialog.Title className="text-sm">New view</Dialog.Title>
        <Dialog.Description className="mt-2 text-xs text-muted-foreground">{conceptIds.length ? `${conceptIds.length} selected concept` : 'Empty view · 0 concepts'}. Views reference shared concepts, not copies.</Dialog.Description>
        <ViewNameForm submitLabel="Create view" onSubmit={(name) => {
          host.ui.createView(name, conceptIds)
          setOpen(false)
        }} />
      </DialogPopup>
    </Dialog.Root>
  )
}

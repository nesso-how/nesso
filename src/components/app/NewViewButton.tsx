import { useState, type Ref } from 'react'
import { LayersPlus } from 'lucide-react'
import { Button, Dialog, DialogPopup } from '@nesso/ui'
import { host } from '@/store'
import { ViewNameForm } from './ViewNameForm'

export function NewViewButton({ iconOnly = false, ref }: { iconOnly?: boolean; ref?: Ref<HTMLButtonElement> }) {
  const [open, setOpen] = useState(false)
  const [conceptIds, setConceptIds] = useState<readonly string[]>([])

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        setConceptIds(host.store.getState().selected.filter((item) => item.kind === 'concept').map((item) => item.id))
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
        <Dialog.Description className="mt-2 text-xs text-muted-foreground">{conceptIds.length ? `${conceptIds.length} selected ${conceptIds.length === 1 ? 'concept' : 'concepts'}` : 'Empty view · 0 concepts'}. Views reference shared concepts, not copies.</Dialog.Description>
        <ViewNameForm submitLabel="Create view" onSubmit={(name) => {
          host.store.createView(name, conceptIds)
          setOpen(false)
        }} />
      </DialogPopup>
    </Dialog.Root>
  )
}

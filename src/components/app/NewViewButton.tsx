import { useId, useState, type Ref } from 'react'
import { LayersPlus } from 'lucide-react'
import { Button, Dialog, DialogPopup, Input, Label } from '@nesso/ui'
import { host, useNessoStore } from '@/store'

export function NewViewButton({ iconOnly = false, ref }: { iconOnly?: boolean; ref?: Ref<HTMLButtonElement> }) {
  const selected = useNessoStore((state) => state.selected)
  const [open, setOpen] = useState(false)
  const [conceptIds, setConceptIds] = useState<readonly string[]>([])
  const [name, setName] = useState('')
  const nameId = useId()

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        setName('')
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
        <form className="mt-6" onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) {
            host.ui.createView(name, conceptIds)
            setOpen(false)
          }
        }}>
          <Label htmlFor={nameId}>Name</Label>
          <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} maxLength={70} className="mt-2" />
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
            <Button type="submit" disabled={!name.trim()}>Create view</Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog.Root>
  )
}

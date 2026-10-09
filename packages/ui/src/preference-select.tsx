import { useId } from 'react'
import { Button } from './button'
import { Combobox, ComboboxItem, ComboboxPopup } from './combobox'
import { Field } from './row'
import { Label } from './label'
import { Check, ChevronDown } from 'lucide-react'

export function PreferenceSelect({ label, items, value, onChange, disabled }: {
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <Field>
      <Label id={`${id}-label`} htmlFor={id} className="w-fit">{label}</Label>
      <Combobox.Root items={items} value={items.find((item) => item.value === value)} onValueChange={(item) => { if (item) onChange(item.value) }} filter={null} disabled={disabled}>
        <Combobox.Trigger id={id} aria-labelledby={`${id}-label`} render={<Button variant="outline" className="w-full justify-between" />}>
          <Combobox.Value /><ChevronDown className="text-muted-foreground" />
        </Combobox.Trigger>
        <ComboboxPopup className="nesso-field-popup">
          <Combobox.List>
            {(item: typeof items[number]) => <ComboboxItem key={item.value} value={item} className="flex items-center justify-between">
              {item.label}<Combobox.ItemIndicator><Check className="size-3.5" /></Combobox.ItemIndicator>
            </ComboboxItem>}
          </Combobox.List>
        </ComboboxPopup>
      </Combobox.Root>
    </Field>
  )
}

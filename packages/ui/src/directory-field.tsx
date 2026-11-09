import { useId } from 'react'
import { Folder, RotateCcw } from 'lucide-react'
import { Button, IconButton } from './button'
import { Input } from './input'

export function DirectoryField({
  label,
  value,
  labels,
  disabled,
  changeDisabled,
  onOpen,
  onChange,
  onRestore,
}: {
  label: string
  value?: string
  labels: { open: string; change: string; restore: string }
  disabled?: boolean
  changeDisabled?: boolean
  onOpen: () => void
  onChange: () => void
  onRestore?: () => void
}) {
  const id = useId()
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-xs">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input id={id} className="pr-10" readOnly value={value ?? ''} title={value} />
          <IconButton
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            aria-label={labels.open}
            title={labels.open}
            disabled={disabled}
            onClick={onOpen}
          >
            <Folder aria-hidden="true" />
          </IconButton>
        </div>
        <Button variant="outline" disabled={disabled || changeDisabled} onClick={onChange}>
          {labels.change}
        </Button>
      </div>
      {onRestore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={disabled || changeDisabled}
          onClick={onRestore}
        >
          <RotateCcw aria-hidden="true" />
          {labels.restore}
        </Button>
      )}
    </div>
  )
}

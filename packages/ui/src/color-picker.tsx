import { hexToHsv, hsvToHex, type Hsv } from './color'
import { IconButton } from './button'
import { Input } from './input'
import { Label } from './label'
import { Popover, PopoverPopup } from './popover'
import { Check, Copy, Minus, RotateCcw } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const defaultColor = '#ffffff'
const clamp = (value: number): number => Math.max(0, Math.min(1, value))

export function ColorPicker({
  value: color,
  onValueChange,
  onCopyError,
  labels,
  presets,
  disabled = false,
  inputProps,
}: {
  value?: string | null
  onValueChange: (value: string | undefined, interactionId?: string) => void
  onCopyError: () => void
  labels: Record<
    | 'color'
    | 'chooseColor'
    | 'title'
    | 'saturationBrightness'
    | 'saturationHint'
    | 'hue'
    | 'colorPresets'
    | 'hex'
    | 'copyColor'
    | 'copied'
    | 'colorInvalid'
    | 'default'
    | 'mixed'
    | 'resetColor',
    string
  >
  presets: readonly { label: string; value: string }[]
  disabled?: boolean
  inputProps?: ComponentProps<'input'> & {
    [attribute: `data-${string}`]: string | boolean | undefined
  }
}) {
  const hexId = useId()
  const hint = `${hexId}-hint`
  const copyTimer = useRef<number | undefined>(undefined)
  const colorGroup = useRef<string | undefined>(undefined)
  const value = color ?? defaultColor
  const mixed = color === null
  const [picker, setPicker] = useState(() => ({ value, hsv: hexToHsv(value, 0) }))
  if (picker.value !== value) setPicker({ value, hsv: hexToHsv(value, picker.hsv.h) })
  const { hsv } = picker
  const [open, setOpen] = useState(false)
  const [copiedValue, setCopiedValue] = useState<string | null>(null)
  const [hexDraft, setHexDraft] = useState<{ value: string; invalid: boolean } | null>(null)
  const copied = copiedValue === value

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const apply = (next: Hsv, interactionId?: string) => {
    const color = hsvToHex(next)
    setPicker({ value: color, hsv: next })
    colorGroup.current = interactionId
    onValueChange(color, interactionId)
  }

  const onAreaPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    if (event.type === 'pointerdown') {
      if (event.button !== 0) return
      event.preventDefault()
      target.focus({ preventScroll: true })
      target.setPointerCapture(event.pointerId)
      colorGroup.current = crypto.randomUUID()
    }
    if (!target.hasPointerCapture(event.pointerId)) return
    const { left, top, width, height } = target.getBoundingClientRect()
    apply(
      {
        ...hsv,
        s: clamp((event.clientX - left) / width),
        v: 1 - clamp((event.clientY - top) / height),
      },
      colorGroup.current,
    )
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      target.releasePointerCapture(event.pointerId)
      colorGroup.current = undefined
    }
  }

  const onAreaKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01
    let next: Hsv | undefined
    if (event.key === 'ArrowLeft') next = { ...hsv, s: clamp(hsv.s - step) }
    else if (event.key === 'ArrowRight') next = { ...hsv, s: clamp(hsv.s + step) }
    else if (event.key === 'ArrowUp') next = { ...hsv, v: clamp(hsv.v + step) }
    else if (event.key === 'ArrowDown') next = { ...hsv, v: clamp(hsv.v - step) }
    else return
    event.preventDefault()
    apply(next)
  }

  const changeHex = (raw: string) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(raw.trim())
    setHexDraft({ value: raw, invalid: !match })
    if (match) apply(hexToHsv(`#${match[1]}`, hsv.h))
  }

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value.toUpperCase())
      setCopiedValue(value)
      clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedValue(null), 2500)
    } catch {
      setCopiedValue(null)
      onCopyError()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{labels.color}</Label>
      <div className="flex min-h-8 items-center gap-1 rounded-sm border border-input bg-background p-1">
        <Popover.Root open={disabled ? false : open} onOpenChange={setOpen}>
          <Popover.Trigger
            render={<IconButton className="size-6" />}
            aria-label={labels.chooseColor}
            disabled={disabled}
          >
            <span
              className="grid size-4 shrink-0 place-items-center rounded-xs border border-node-border bg-muted"
              style={{ background: mixed ? undefined : value }}
              aria-hidden="true"
            >
              {mixed && <Minus />}
            </span>
          </Popover.Trigger>
          <PopoverPopup className="flex w-58 flex-col gap-3" aria-label={labels.title}>
            <div
              tabIndex={0}
              role="group"
              aria-label={labels.saturationBrightness}
              aria-describedby={hint}
              className="relative h-32 touch-none rounded-xs cursor-crosshair focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
              style={{
                backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
                backgroundImage:
                  'linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, transparent)',
              }}
              onPointerDown={onAreaPointer}
              onPointerMove={onAreaPointer}
              onPointerUp={onAreaPointer}
              onPointerCancel={onAreaPointer}
              onKeyDown={onAreaKeyDown}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_#29292980]"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              />
            </div>
            <p id={hint} className="sr-only">
              {labels.saturationHint}
            </p>
            <input
              id={`${hexId}-hue`}
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(hsv.h) % 360}
              aria-label={labels.hue}
              className="nesso-color-hue h-5 w-full cursor-pointer focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
              onBlur={() => {
                colorGroup.current = undefined
              }}
              onPointerDown={() => {
                colorGroup.current = crypto.randomUUID()
              }}
              onPointerUp={() => {
                colorGroup.current = undefined
              }}
              onPointerCancel={() => {
                colorGroup.current = undefined
              }}
              onChange={(event) =>
                apply(
                  { ...hsv, h: Number(event.target.value) },
                  (colorGroup.current ??= crypto.randomUUID()),
                )
              }
            />
            <div role="group" aria-label={labels.colorPresets} className="flex justify-between">
              {presets.map((preset) => (
                <IconButton
                  key={preset.value}
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={!mixed && preset.value === value}
                  onClick={() => apply(hexToHsv(preset.value, hsv.h))}
                  className="size-6 [&_svg]:size-3"
                >
                  <span
                    className="grid size-4 place-items-center rounded-xs border border-black/10"
                    style={{ background: preset.value }}
                    aria-hidden="true"
                  >
                    {!mixed && preset.value === value && (
                      <Check className="text-foreground" aria-hidden="true" />
                    )}
                  </span>
                </IconButton>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={hexId} className="shrink-0">
                {labels.hex}
              </Label>
              <div className="relative min-w-0 flex-1">
                <Input
                  {...inputProps}
                  id={hexId}
                  value={hexDraft?.value ?? (mixed ? '' : value.toUpperCase())}
                  placeholder={mixed ? labels.mixed : undefined}
                  maxLength={7}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={hexDraft?.invalid ?? false}
                  aria-describedby={`${hexId}-error`}
                  className="h-7 pr-8 font-mono text-[11px]"
                  onChange={(event) => changeHex(event.target.value)}
                  onBlur={() => setHexDraft(null)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (!hexDraft?.invalid) setOpen(false)
                    }
                  }}
                />
                <IconButton
                  aria-label={copied ? labels.copied : labels.copyColor}
                  title={copied ? labels.copied : labels.copyColor}
                  onClick={copyValue}
                  disabled={mixed}
                  className="absolute right-1 top-1/2 size-5 -translate-y-1/2"
                >
                  {copied ? <Check /> : <Copy />}
                </IconButton>
              </div>
            </div>
            {hexDraft?.invalid && (
              <p id={`${hexId}-error`} role="alert" className="text-xs text-destructive">
                {labels.colorInvalid}
              </p>
            )}
          </PopoverPopup>
        </Popover.Root>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] leading-4 text-muted-foreground">
          {mixed ? labels.mixed : color ? value.toUpperCase() : labels.default}
        </span>
        <IconButton
          aria-label={labels.resetColor}
          title={labels.resetColor}
          disabled={disabled || (!mixed && !color)}
          onClick={() => onValueChange(undefined)}
        >
          <RotateCcw />
        </IconButton>
      </div>
    </div>
  )
}

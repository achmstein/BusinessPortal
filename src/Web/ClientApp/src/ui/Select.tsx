import { Select as ArkSelect, createListCollection } from '@ark-ui/react/select'
import { Portal } from '@ark-ui/react/portal'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

// Field.Select was ArkField.Select — a native <select>. Ark styles the closed
// control, but the dropdown it opens is operating-system chrome: it cannot take
// the accent, the radius or the shadow, and it sat next to a themed calendar
// looking like it belonged to a different application.
//
// The one wrapper in here with a data-driven API rather than composed parts. A
// select is a list of values, not a layout, and every call site was already
// mapping an array to <option> — handing it `items` removes that map instead of
// renaming it.
//
// Trade-off worth knowing: this is a custom listbox, so phones get it rather
// than the native iOS wheel / Android sheet. Ark's keyboard and touch handling
// is solid, but if a screen ever needs the native mobile picker specifically,
// that is the reason to keep a plain <select> there.

export interface SelectItem {
  value: string
  label: string
}

export function Select({
  items,
  value,
  onChange,
  placeholder = 'Select…',
  id,
  name,
  disabled,
  invalid,
  className,
}: {
  items: SelectItem[]
  /** '' means nothing chosen — the placeholder shows. */
  value: string
  onChange: (next: string) => void
  placeholder?: string
  id?: string
  /** Renders a hidden native select, so browser autofill still works. */
  name?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  const collection = createListCollection({ items })

  return (
    <ArkSelect.Root
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => onChange(details.value[0] ?? '')}
      disabled={disabled}
      positioning={{ sameWidth: true, placement: 'bottom-start' }}
      className={className}
    >
      <ArkSelect.Control>
        <ArkSelect.Trigger
          id={id}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3',
            'text-left text-sm text-ink transition-colors',
            'focus:outline-none focus-visible:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500/30',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint',
            invalid ? 'border-danger-500 ring-2 ring-danger-500/25' : 'border-rule-firm',
          )}
        >
          <ArkSelect.ValueText placeholder={placeholder} className="truncate data-[placeholder]:text-ink-faint/70" />
          <ArkSelect.Indicator className="shrink-0 text-ink-faint">
            <ChevronsUpDown aria-hidden className="size-4" />
          </ArkSelect.Indicator>
        </ArkSelect.Trigger>
      </ArkSelect.Control>

      <Portal>
        <ArkSelect.Positioner>
          <ArkSelect.Content
            className={cn(
              'z-60 max-h-72 overflow-y-auto rounded-lg border border-rule bg-surface p-1',
              'shadow-overlay focus:outline-none',
            )}
          >
            {items.map((item) => (
              <ArkSelect.Item
                key={item.value}
                item={item}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2',
                  'text-sm text-ink-muted transition-colors',
                  'data-[highlighted]:bg-surface-sunken data-[highlighted]:text-ink',
                  'data-[state=checked]:font-medium data-[state=checked]:text-ink',
                )}
              >
                <ArkSelect.ItemText>{item.label}</ArkSelect.ItemText>
                <ArkSelect.ItemIndicator className="text-accent-600">
                  <Check aria-hidden className="size-4" />
                </ArkSelect.ItemIndicator>
              </ArkSelect.Item>
            ))}
          </ArkSelect.Content>
        </ArkSelect.Positioner>
      </Portal>

      <ArkSelect.HiddenSelect name={name} />
    </ArkSelect.Root>
  )
}

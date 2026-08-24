import { Field as ArkField } from '@ark-ui/react/field'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Ark's Field wires label/description/error to the control with the right ids
// and aria-invalid / aria-describedby. That wiring is the whole reason this
// exists: the portal previously had zero field-level errors and zero
// aria-invalid attributes — every failure surfaced as a banner at the top of
// the page, often several screens away from the input that caused it.

const CONTROL = cn(
  'block w-full rounded-sm bg-surface px-3 text-sm text-ink',
  'ring-1 ring-rule-firm placeholder:text-sage/70',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-bottle-500',
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-sage',
  'data-[invalid]:ring-rust-500 data-[invalid]:ring-2',
)

interface FieldProps {
  label: string
  /** Help text shown under the label, before any error. */
  hint?: ReactNode
  /** Message from validation. Presence flips the field into its invalid state. */
  error?: string
  required?: boolean
  disabled?: boolean
  className?: string
  children: ReactNode
}

/**
 * Labelled form control. Pass exactly one input as the child:
 *
 *   <Field label="Business name" error={errors.name?.message}>
 *     <Field.Input {...register('name')} />
 *   </Field>
 */
export function Field({ label, hint, error, required, disabled, className, children }: FieldProps) {
  return (
    <ArkField.Root
      invalid={Boolean(error)}
      required={required}
      disabled={disabled}
      className={cn('flex flex-col gap-1.5', className)}
    >
      <ArkField.Label className="text-sm font-medium text-ink-muted">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-rust-600">
            *
          </span>
        ) : null}
      </ArkField.Label>

      {children}

      {hint && !error ? (
        <ArkField.HelperText className="text-xs text-sage">{hint}</ArkField.HelperText>
      ) : null}

      {/* Rendered in a live region by Ark, so screen readers announce the
          failure instead of it being visible-only. */}
      <ArkField.ErrorText className="text-xs font-medium text-rust-600">{error}</ArkField.ErrorText>
    </ArkField.Root>
  )
}

Field.Input = function FieldInput({ className, ...props }: React.ComponentProps<typeof ArkField.Input>) {
  return <ArkField.Input className={cn(CONTROL, 'h-10', className)} {...props} />
}

Field.Textarea = function FieldTextarea({
  className,
  ...props
}: React.ComponentProps<typeof ArkField.Textarea>) {
  return <ArkField.Textarea className={cn(CONTROL, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />
}

Field.Select = function FieldSelect({ className, ...props }: React.ComponentProps<typeof ArkField.Select>) {
  return <ArkField.Select className={cn(CONTROL, 'h-10 pr-8', className)} {...props} />
}

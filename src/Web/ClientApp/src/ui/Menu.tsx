import type { ComponentProps, ReactNode } from 'react'
import { Menu as ArkMenu } from '@ark-ui/react/menu'
import { Portal } from '@ark-ui/react/portal'
import { cn } from '@/lib/cn'

// Ark supplies the roving tabindex, typeahead, Escape handling and focus
// return. This file supplies the entire appearance — with a headless library
// there is nowhere else for it to live.
//
// Parts mirror Ark's names so composition stays open. The one deviation:
// Content bundles Portal + Positioner, which were identical at every call site
// and cause clipping bugs when forgotten.

export const Menu = {
  Root: ArkMenu.Root,

  Trigger: ({ className, ...props }: ComponentProps<typeof ArkMenu.Trigger>) => (
    <ArkMenu.Trigger
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-muted',
        'transition-colors hover:bg-surface-sunken hover:text-ink',
        className,
      )}
      {...props}
    />
  ),

  Content: ({ className, children, ...props }: ComponentProps<typeof ArkMenu.Content>) => (
    <Portal>
      <ArkMenu.Positioner>
        <ArkMenu.Content
          className={cn(
            'z-50 min-w-56 rounded-lg border border-rule bg-surface p-1 shadow-overlay',
            'focus:outline-none',
            className,
          )}
          {...props}
        >
          {children}
        </ArkMenu.Content>
      </ArkMenu.Positioner>
    </Portal>
  ),

  Item: ({
    className,
    tone = 'default',
    ...props
  }: ComponentProps<typeof ArkMenu.Item> & { tone?: 'default' | 'danger' }) => (
    <ArkMenu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        tone === 'danger'
          ? 'text-danger-600 data-[highlighted]:bg-danger-50 data-[highlighted]:text-danger-700'
          : 'text-ink-muted data-[highlighted]:bg-surface-sunken data-[highlighted]:text-ink',
        className,
      )}
      {...props}
    />
  ),

  Separator: ({ className }: { className?: string }) => (
    <div role="separator" className={cn('my-1 h-px bg-rule', className)} />
  ),

  /** Not an Ark part. The identity block every menu in this app opens with. */
  Header: ({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) => (
    <div className="border-b border-rule px-3 py-2">
      <p className="truncate text-sm font-medium text-ink">{title}</p>
      {subtitle ? <p className="truncate text-xs text-ink-faint">{subtitle}</p> : null}
    </div>
  ),
}

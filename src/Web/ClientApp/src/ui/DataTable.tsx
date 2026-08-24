import {
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────────
// The admin table.
//
// v9 tree-shakes features, so only what's used is registered: sorting, applied
// to the rows already fetched. Filtering and paging are the server's job — the
// registry spans every client, and no amount of client-side cleverness makes
// shipping all of it to a browser correct.
//
// Per-column extras go through v9's `columnMeta` slot rather than global
// declaration merging, so the type is scoped to this table instead of being
// patched onto the library for the whole app.
//
// Deliberately small: it renders header groups, cells and a sort control. It
// does not own the toolbar, because filters differ per screen and an abstracted
// toolbar becomes a configuration language nobody wants to learn.
// ─────────────────────────────────────────────────────────────────────────────

interface ColumnExtras {
  /** Right-align — for figures, never for text. */
  numeric?: boolean
  /** Applied to header and cells alike; carries responsive column hiding. */
  className?: string
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
  columnMeta: {} as ColumnExtras,
})

type Features = typeof features

export type DataTableColumn<TData extends RowData> = ColumnDef<Features, TData>

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumn<TData>[]
  data: TData[]
  /** Required: every table has to say what "nothing here" means. */
  empty: ReactNode
  onRowClick?: (row: TData) => void
  className?: string
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  empty,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const table = useTable({ features, columns, data })
  const rows = table.getRowModel().rows

  return (
    <div className={cn('overflow-x-auto rounded-sm bg-surface ring-1 ring-rule', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-rule bg-surface-sunken">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const sorted = header.column.getIsSorted()
                const canSort = header.column.getCanSort()
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className={cn(
                      'px-4 py-2.5 text-left text-xs font-semibold tracking-[0.1em] text-sage uppercase',
                      meta?.numeric && 'text-right',
                      meta?.className,
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={() => header.column.toggleSorting()}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-xs hover:text-ink',
                          meta?.numeric && 'flex-row-reverse',
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? (
                          <ArrowUp aria-hidden className="size-3" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown aria-hidden className="size-3" />
                        ) : (
                          <ChevronsUpDown aria-hidden className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  'border-b border-rule last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-sunken/60',
                )}
              >
                {row.getAllCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 align-top text-ink',
                        meta?.numeric && 'text-right tabular-nums',
                        meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Server-side pager. Deliberately not TanStack's — the row count lives on the
 * server, so there is no client row model to paginate.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-sage">
        <span data-numeric>
          {first}–{last}
        </span>{' '}
        of{' '}
        <span data-numeric className="text-ink">
          {total}
        </span>
      </p>
      <nav aria-label="Pages" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-sm px-3 py-1.5 text-sm text-ink-muted ring-1 ring-rule-firm hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="px-2 text-sm text-sage" data-numeric>
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="rounded-sm px-3 py-1.5 text-sm text-ink-muted ring-1 ring-rule-firm hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </nav>
    </div>
  )
}

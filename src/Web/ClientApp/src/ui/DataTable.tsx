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
import { Pagination as ArkPagination } from '@ark-ui/react/pagination'
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

// The two pager button shapes; four call sites between them.
const PAGER_NAV = cn(
  'rounded-md border border-rule-firm bg-surface px-3 py-1.5 text-sm text-ink-muted shadow-card',
  'transition-colors hover:bg-surface-sunken',
  'disabled:cursor-not-allowed disabled:opacity-40',
)

const PAGER_ITEM = cn(
  'min-w-8 cursor-pointer rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors',
  'hover:bg-surface-sunken hover:text-ink',
  'data-[selected]:bg-accent-600 data-[selected]:font-medium data-[selected]:text-paper',
)

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
    <div className={cn('overflow-x-auto rounded-xl border border-rule bg-surface shadow-card', className)}>
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
                      'px-4 py-2.5 text-left text-xs font-semibold tracking-[0.1em] text-ink-faint uppercase',
                      meta?.numeric && 'text-right',
                      meta?.className,
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={() => header.column.toggleSorting()}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm hover:text-ink',
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
 *
 * Previously prev/next plus a "3 / 14" readout, which made reaching page 9 an
 * eight-click job on a registry that routinely runs to a dozen pages. Ark
 * computes the page window and the ellipsis positions, and marks the current
 * page with aria-current.
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
  if (total === 0) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <ArkPagination.Root
      count={total}
      pageSize={pageSize}
      page={page}
      onPageChange={(details) => onPage(details.page)}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-ink-faint">
        <span data-numeric>
          {first}–{last}
        </span>{' '}
        of{' '}
        <span data-numeric className="text-ink">
          {total}
        </span>
      </p>

      <nav aria-label="Pages" className="flex items-center gap-1">
        <ArkPagination.PrevTrigger className={PAGER_NAV}>Previous</ArkPagination.PrevTrigger>

        <ArkPagination.Context>
          {(api) =>
            api.pages.map((item, index) =>
              item.type === 'page' ? (
                <ArkPagination.Item key={index} {...item} data-numeric className={PAGER_ITEM}>
                  {item.value}
                </ArkPagination.Item>
              ) : (
                <ArkPagination.Ellipsis key={index} index={index} className="px-1 text-sm text-ink-faint">
                  &#8230;
                </ArkPagination.Ellipsis>
              ),
            )
          }
        </ArkPagination.Context>

        <ArkPagination.NextTrigger className={PAGER_NAV}>Next</ArkPagination.NextTrigger>
      </nav>
    </ArkPagination.Root>
  )
}

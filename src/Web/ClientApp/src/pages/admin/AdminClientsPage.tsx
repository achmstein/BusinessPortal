import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getAdminClientsOptions } from '@/api/generated/@tanstack/react-query.gen'
import type { AdminClientRow } from '@/api/generated'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { formatDate } from '@/lib/dates'
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  type DataTableColumn,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Finding one client among many. Searching and paging happen on the server now;
// this page used to pull every client and filter them in the browser, and it
// hand-declared its own Client interface rather than using the generated type,
// so the two could drift apart silently.
//
// keepPreviousData means typing doesn't collapse the table to a spinner on each
// keystroke — the previous rows stay while the next page resolves.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

export function AdminClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(search)

  const clients = useQuery({
    ...getAdminClientsOptions({ query: { q: debounced || undefined, page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataTableColumn<AdminClientRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Client',
        accessorFn: (row) => `${row.lastName ?? ''} ${row.firstName ?? ''}`.trim(),
        cell: ({ row }) => {
          const name = `${row.original.firstName ?? ''} ${row.original.lastName ?? ''}`.trim()
          return (
            <div className="flex items-center gap-2.5">
              <Avatar
                firstName={row.original.firstName}
                lastName={row.original.lastName}
                email={row.original.email}
                size="sm"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-ink">{name || '—'}</span>
                <span className="truncate text-xs text-ink-faint">{row.original.email}</span>
              </div>
            </div>
          )
        },
      },
      {
        id: 'ato',
        header: 'ATO',
        accessorFn: (row) => (row.atoConnected ? 1 : 0),
        cell: ({ row }) =>
          row.original.atoConnected ? <Badge tone="ok">Connected</Badge> : <span className="text-ink-faint">—</span>,
        meta: { className: 'hidden sm:table-cell' },
      },
      {
        id: 'joined',
        header: 'Joined',
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => <span className="text-ink-faint">{formatDate(row.original.createdAt)}</span>,
        meta: { className: 'hidden md:table-cell' },
      },
    ],
    [],
  )

  const total = Number(clients.data?.totalCount ?? 0)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Clients" description="Everyone with a portal account." />

      <SearchInput
        label="Search clients"
        className="max-w-sm"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(1)
        }}
        placeholder="Search by name or email"
      />

      {clients.isError ? (
        <ErrorState
          description="We couldn’t load the client list."
          action={
            <Button variant="secondary" onClick={() => void clients.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={clients.data?.items ?? []}
            onRowClick={(row) => navigate(`/admin/clients/${row.id}`)}
            empty={
              <EmptyState
                title={debounced ? 'No matches' : 'No clients yet'}
                description={
                  debounced
                    ? `Nothing matches “${debounced}”. Try part of an email address.`
                    : 'Clients appear here once they have a portal account.'
                }
                className="border-0 bg-transparent"
              />
            }
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  )
}

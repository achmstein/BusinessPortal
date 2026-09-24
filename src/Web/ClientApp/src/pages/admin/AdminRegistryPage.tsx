import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  getRegistryBusinessNamesOptions,
  getRegistryCompaniesOptions,
  getRegistryEntitiesOptions,
  getRegistrySummaryOptions,
} from '@/api/generated/@tanstack/react-query.gen'
import type {
  RegistryBusinessNameRow,
  RegistryClientRef,
  RegistryCompanyRow,
  RegistryEntityRow,
} from '@/api/generated'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { formatDate } from '@/lib/dates'
import { formatAbn, formatAcn } from '@/lib/format'
import { renewalStatus } from '@/lib/renewal'
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  HoverCard,
  PageHeader,
  Pagination,
  SearchInput,
  Tabs,
  type DataTableColumn,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Every client's records in one place.
//
// This page used to call one unparameterised endpoint returning every business
// name, entity and company across every client, then filter all three sets in
// render — unmemoised, per row, per keystroke — with no paging at all. It got
// slower with every customer signed up. Each tab is now its own searched, paged
// server query.
//
// Three tabs rather than three stacked tables: they answer different questions,
// and stacking meant scrolling past two to reach the third. Tab counts come from
// three COUNTs, so they stay honest without loading rows to length them.
//
// Renewal urgency uses the same renewalStatus() the client portal uses, so what
// staff see on a name matches what its owner sees.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

type Tab = 'names' | 'entities' | 'companies'

// The link still goes to the client page; the preview only saves the trip when
// the question is just "who is this?" — so it stays supplementary, and nothing
// lives in it that isn't reachable by following the link.
function ClientLink({ client }: { client: RegistryClientRef }) {
  return (
    <HoverCard
      content={
        <div className="flex items-center gap-2.5">
          <Avatar name={client.name} email={client.email} size="sm" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-ink">{client.name}</span>
            {client.email ? (
              <span className="truncate text-xs text-ink-faint">{client.email}</span>
            ) : null}
          </div>
        </div>
      }
    >
      <Link
        to={`/admin/clients/${client.id}`}
        onClick={(event) => event.stopPropagation()}
        className="text-accent-600 hover:underline"
      >
        {client.name}
      </Link>
    </HoverCard>
  )
}

export function AdminRegistryPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('names')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(search)
  const query = { q: debounced || undefined, page, pageSize: PAGE_SIZE }

  const summary = useQuery(getRegistrySummaryOptions())

  const names = useQuery({
    ...getRegistryBusinessNamesOptions({ query }),
    enabled: tab === 'names',
    placeholderData: keepPreviousData,
  })
  const entities = useQuery({
    ...getRegistryEntitiesOptions({ query }),
    enabled: tab === 'entities',
    placeholderData: keepPreviousData,
  })
  const companies = useQuery({
    ...getRegistryCompaniesOptions({ query }),
    enabled: tab === 'companies',
    placeholderData: keepPreviousData,
  })

  const active = tab === 'names' ? names : tab === 'entities' ? entities : companies

  const nameColumns = useMemo<DataTableColumn<RegistryBusinessNameRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Business name',
        accessorFn: (row) => row.name,
        cell: ({ row }) => <span className="font-medium text-ink">{row.original.name}</span>,
      },
      {
        id: 'client',
        header: 'Client',
        accessorFn: (row) => row.client.name,
        cell: ({ row }) => <ClientLink client={row.original.client} />,
      },
      {
        id: 'renews',
        header: 'Renews',
        accessorFn: (row) => row.renewalDate,
        cell: ({ row }) => {
          const status = renewalStatus(row.original.renewalDate)
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span data-numeric className="text-ink">
                {formatDate(row.original.renewalDate)}
              </span>
              {status.needsAction ? <Badge tone={status.tone}>{status.label}</Badge> : null}
            </div>
          )
        },
      },
      {
        id: 'asicKey',
        header: 'ASIC key',
        accessorFn: (row) => row.asicKey,
        cell: ({ row }) => (
          <span className="text-ink-faint" data-numeric>
            {row.original.asicKey || '—'}
          </span>
        ),
        meta: { className: 'hidden lg:table-cell' },
      },
    ],
    [],
  )

  const entityColumns = useMemo<DataTableColumn<RegistryEntityRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Entity',
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-ink">{row.original.name}</span>
            {row.original.entityType ? (
              <span className="text-xs text-ink-faint">{row.original.entityType}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'client',
        header: 'Client',
        accessorFn: (row) => row.client.name,
        cell: ({ row }) => <ClientLink client={row.original.client} />,
      },
      {
        id: 'abn',
        header: 'ABN',
        accessorFn: (row) => row.abn,
        cell: ({ row }) => (
          <span data-numeric className="text-ink">
            {formatAbn(row.original.abn) || '—'}
          </span>
        ),
      },
      {
        id: 'industry',
        header: 'Industry',
        accessorFn: (row) => row.industry,
        cell: ({ row }) => <span className="text-ink-faint">{row.original.industry || '—'}</span>,
        meta: { className: 'hidden lg:table-cell' },
      },
    ],
    [],
  )

  const companyColumns = useMemo<DataTableColumn<RegistryCompanyRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Company or trust',
        accessorFn: (row) => row.name,
        cell: ({ row }) => <span className="font-medium text-ink">{row.original.name}</span>,
      },
      {
        id: 'client',
        header: 'Client',
        accessorFn: (row) => row.client.name,
        cell: ({ row }) => <ClientLink client={row.original.client} />,
      },
      {
        id: 'acn',
        header: 'ACN',
        accessorFn: (row) => row.acn,
        cell: ({ row }) => (
          <span data-numeric className="text-ink">
            {formatAcn(row.original.acn) || '—'}
          </span>
        ),
      },
      {
        id: 'abn',
        header: 'ABN',
        accessorFn: (row) => row.abn,
        cell: ({ row }) => (
          <span data-numeric className="text-ink-faint">
            {formatAbn(row.original.abn) || '—'}
          </span>
        ),
        meta: { className: 'hidden lg:table-cell' },
      },
    ],
    [],
  )

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'names', label: 'Business names', count: Number(summary.data?.businessNames ?? NaN) },
    { id: 'entities', label: 'Entities', count: Number(summary.data?.entities ?? NaN) },
    { id: 'companies', label: 'Companies & trusts', count: Number(summary.data?.companies ?? NaN) },
  ]

  const emptyState = (
    <EmptyState
      title={debounced ? 'No matches' : 'Nothing here yet'}
      description={debounced ? `Nothing matches “${debounced}”.` : 'Records appear as clients add them.'}
      className="border-0 bg-transparent"
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Registry"
        description={
          summary.data
            ? `Across ${summary.data.clients} ${Number(summary.data.clients) === 1 ? 'client' : 'clients'}.`
            : undefined
        }
      />

      <Tabs.Root
        lazyMount
        unmountOnExit
        value={tab}
        onValueChange={(details) => {
          setTab(details.value as Tab)
          setPage(1)
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule">
          <Tabs.List aria-label="Registry sections">
            {tabs.map((item) => (
              <Tabs.Trigger key={item.id} value={item.id}>
                {item.label}
                <Tabs.Count value={item.count} />
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <SearchInput
            label="Search the registry"
            size="sm"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search this tab"
            className="mb-2 w-full max-w-xs"
          />
        </div>

        {active.isError ? (
          <ErrorState
            description="We couldn’t load that part of the registry."
            action={
              <Button variant="secondary" onClick={() => void active.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            <Tabs.Content value="names">
              <DataTable
                columns={nameColumns}
                data={names.data?.items ?? []}
                empty={emptyState}
                onRowClick={(row) => navigate(`/admin/clients/${row.client.id}`)}
              />
            </Tabs.Content>
            <Tabs.Content value="entities">
              <DataTable
                columns={entityColumns}
                data={entities.data?.items ?? []}
                empty={emptyState}
                onRowClick={(row) => navigate(`/admin/clients/${row.client.id}`)}
              />
            </Tabs.Content>
            <Tabs.Content value="companies">
              <DataTable
                columns={companyColumns}
                data={companies.data?.items ?? []}
                empty={emptyState}
                onRowClick={(row) => navigate(`/admin/clients/${row.client.id}`)}
              />
            </Tabs.Content>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={Number(active.data?.totalCount ?? 0)}
              onPage={setPage}
            />
          </>
        )}
      </Tabs.Root>
    </div>
  )
}

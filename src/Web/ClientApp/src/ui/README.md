# UI rules

Ark gives us behaviour (focus, keyboard, popups, layering). This folder gives
us appearance and composition. Pages import from `@/ui` only — never from
`@ark-ui/react`, and never re-create a pattern that exists here.

## Page structure

```tsx
<Page title="…" description="…" actions={…} back={{ to, label }}>
  <Section title="…" meta="3 items" action={<TextLink to="…" arrow>Manage</TextLink>}>
    <List>…<List.Row>…</List.Row>…</List>
  </Section>
</Page>
```

- **Every page is a `<Page>`.** It owns the header, the back link and the 24px
  rhythm between blocks. Do not add `max-w-*` to a page — the shell sets the
  width, and every page uses all of it.
- **Loading and error states render inside `<Page>`**, so a failed request never
  loses the title. Use `<PageSkeleton />` for loading and `<ErrorState>` with a
  "Try again" button for failures.
- **Detail pages** pass `back` rather than hand-building an arrow link.

## Blocks

| Need | Use |
| --- | --- |
| A titled block on the page | `Section` |
| A heading inside a panel | `PanelTitle` (same style as `Section`) |
| Main register entries (business names, businesses, renewals) | `RecordList` + `Record`, named with `RecordTitle` |
| Compact rows: summaries, queues, history, inboxes | `List` + `List.Row` |
| Forms and reference blocks | `Panel` |
| Tabular admin data with sorting and paging | `DataTable` + `Pagination` |
| Nothing to show | `EmptyState` (always with a way forward) |

There is one heading style below the page title. Don't size headings by hand
(`font-display text-xl …`), and don't pass size classes to `PanelTitle`.

## Actions

- Buttons are the default size. `size="sm"` is for actions inside a row;
  `size="lg"` is only for the full-width submit on the sign-in screens.
- One `primary` button per view. Destructive actions use `danger`, and sit
  behind a menu or a confirm dialog — never beside the primary action.
- In-app text links use `TextLink` (`arrow` to go somewhere, `back` to return).
- Forms that save in place end with `<FormActions dirty saving />`: right
  aligned, "Save changes", disabled until something changed. Dialog forms put
  Cancel + the action in the dialog `footer`.
- Conversation replies use `ReplyBox`.

## Layers

Page chrome 30 · overlay backdrop 40 · dialog/drawer 50 · popups (select, menu,
date picker, hover card) 60 · tooltip 70. Popups must stay above 50 or they
render behind a dialog.

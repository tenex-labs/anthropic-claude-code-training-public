# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** evilsievel
**Status:** done

## Problem

Ops exports the payments table several times a day, but every file contains every column, card last-four included. Anything going to a merchant has to be cleaned up by hand first: 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant. Ops needs to choose the columns and the scope before downloading.

## Current state

All paths are under `build-battle/merchant-console/`.

- `src/app/payments/page.tsx:68-76`: the Export button is a plain `<a href="/api/payments/export?…">` carrying the page's query string. There are no options.
- `src/app/payments/page.tsx:36-43`: the page builds its own `PaymentFilters` instead of calling `parseFilters`, so it ignores `from`, `to`, `sort` and `direction`. The export route honours all of them, so the row count the page shows can differ from what the export writes for the same URL.
- `src/app/api/payments/export/route.ts:11-25`: `parseFilters` → `filterPayments` → `sortPayments` → `toCsv(rows)` with the fixed column set, named by `exportFilename()`. There's no pagination, so it already exports every matching row, not just the current page.
- `src/data/queries.ts:18-36`: `parseFilters` is the existing allowlist for status, sort, direction and page. `src/data/queries.ts:45-70`: `filterPayments` is the one query builder. With no filters it returns every payment.
- `src/lib/csv.ts:13-26`: `EXPORT_COLUMNS` / `ExportColumn` is the column list and the natural allowlist. `src/lib/csv.ts:58-67`: `toCsv(payments, columns)` already accepts a column subset and keeps the order given. `src/lib/csv.ts:69-71`: `exportFilename(date)` stamps the UTC date only.
- `src/lib/csv.test.ts:32-36`: a column-subset case is already tested. `:26-30` expects `toCsv` with no columns to write all of `EXPORT_COLUMNS`, so `toCsv`'s default must not change.
- `src/lib/money.ts:15`: `formatMoney` is the only formatter. `csv.ts` already uses it for `amount`, with `currency` in its own column.
- `src/components/Drawer.tsx`: built on `@radix-ui/react-dialog`. There's no `Dialog.tsx` and no checkbox or radio primitive.
- No route handler returns an error today, so there's no existing error shape to match.
- **Ticket vs code:** the ticket warns against interpolating column names into SQL. There is no SQL here. The equivalent risk is a client value reaching the CSV header or the `Content-Disposition` filename.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` | Arbitrary text in the CSV header or the download filename |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut." | `merchant-console/CLAUDE.md` | Table, count and export disagree |
| "Money is integer minor units… Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` | Double formatting, or floats in the file |
| "Building this in the browser exports the current page only" | Ticket notes | Export ships 20 rows instead of all matches |
| "Card last-four is **off** by default." | Ticket AC | The near-miss the ticket was raised for |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Unusable by keyboard and screen reader |

## Approach

Keep the export a server-side GET, made safe and configurable. The route gains two query params, `columns` (comma-separated) and `scope` (`filtered` | `all`), both checked against an allowlist by new pure helpers in `src/lib/csv.ts`. Anything unknown returns a 400 with a JSON `{ error }` message, and the route never echoes client text into the file or filename. `scope=all` calls `filterPayments` with no filters; `filtered` uses `parseFilters` as today, so there is still one query builder. The default column set is everything except `last4`. `exportFilename` takes a label built only from validated values (the status, or `filtered`, or `all`). On the page, a client component opens the existing `Drawer` with column checkboxes (all but last-four ticked), a scope choice showing each scope's row count, and a Download link that is disabled when nothing is selected. The page computes both counts on the server with the same builder, and switches to `parseFilters` so its count matches the export.

**Considered and rejected:** building the CSV in the browser from the table's rows. That only has the current page (the bug the ticket warns about) and would duplicate the serializer. Also rejected: a POST with a JSON body. That would mean replacing a working download link with fetch-and-blob code for no gain, since the values fit in a query string.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `DEFAULT_EXPORT_COLUMNS`; `parseExportColumns` and `parseExportScope` (allowlist validation, deduped, order kept); `exportFilename` takes a scope label |
| `src/lib/csv.test.ts` | change | Tests for the parsers and the filename (see Verification) |
| `src/app/api/payments/export/route.ts` | change | Read and validate `columns` and `scope`, 400 on bad input, choose rows by scope, pass columns to `toCsv`, scoped filename |
| `src/app/payments/export-dialog.tsx` | add | Client component: Drawer, labelled checkboxes, scope radios with counts, Download link or a disabled button |
| `src/app/payments/page.tsx` | change | Use `parseFilters`; compute filtered and all counts with the builder; render the dialog instead of the bare link |

## Plan

1. **Validation helpers in `csv.ts`**: done when `npm test` passes with the existing suite unchanged.
2. **Route handler**: done when `/api/payments/export` with no params gives every column but `last4`; `?columns=id,amount` gives exactly those two in that order; `?columns=bogus`, `?columns=` and `?scope=x` give a 400 JSON error; `?status=disputed&scope=all` gives every payment.
3. **Dialog and page wiring**: done when on `/payments` the Export button opens the drawer, last-four is unticked, both counts show, unticking everything disables Download, Escape closes it and focus returns to the button, and the downloaded file matches the choices.
4. **Tests**: `npm test` before and after adding the new cases, summary reported.
5. **Type-check**: `npx tsc --noEmit` is clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last-four off by default | `csv.test.ts`: the default selection excludes `last4`; a subset keeps the requested order. Manually: the drawer opens with last-four unticked |
| Scope: current filter (default) or all, count shown before download | Route request with and without `scope=all` under a status filter; the drawer shows both counts, and the filtered count equals the table's total |
| Filename reflects scope and date | `csv.test.ts`: `exportFilename` with a label (e.g. `payments-disputed-2026-08-13.csv`); `Content-Disposition` on a live request |
| Amounts stay minor units, formatted once, currency in its own column | Unchanged `formatMoney` path; existing `csv.test.ts` amount cases still pass |
| No columns disables Download | `csv.test.ts`: an empty selection is rejected by the parser (server side); manually: Download disabled in the drawer |
| Column names validated server-side | `csv.test.ts`: an unknown column is rejected; live `?columns=bogus` returns 400 |

## Risks

- Changing the page to `parseFilters` also makes it honour `sort`, `from` and `to` from the URL, a small behaviour change. It's needed so the count matches the file.
- `sortPayments` compares amounts as text (`src/data/queries.ts:81`), so `sort=amount` exports in the wrong order. This exists already and is noted, not fixed here.
- The full-store count is computed on every page render. That's cheap at about 1,680 rows in memory, but worth revisiting with NWP-203 persistence.

## Out of scope

- Fixing the amount sort, and any change to how a cell is written (`escapeCell`, `formatMoney`).
- A reusable `Dialog` primitive in `src/components/`. This uses the existing Drawer.
- Saved export presets, and other export formats.

## Open questions

- Filename label when the scope is the current filter but no status is set (merchant or search only): proposed `filtered`, with `all` when there are no filters at all.

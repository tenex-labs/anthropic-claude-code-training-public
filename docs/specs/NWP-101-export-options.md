# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Claude Code, reviewed by the ticket assignee
**Status:** building

## Problem

Ops exports payments several times a day, and every file carries every column, including card last four. Anything sent to a merchant gets cleaned by hand first, which costs 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant. Ops needs to choose the columns and the scope before the file is made.

## Current state

- `build-battle/merchant-console/src/app/payments/page.tsx` — the Export button is a plain `<a href="/api/payments/export?…">` that forwards the page's query string. No dialog.
- `src/app/api/payments/export/route.ts` — `parseFilters` → `filterPayments` → `sortPayments` → `toCsv(rows)`. It does **not** paginate, so it already exports every matching row. It reads no column or scope parameter.
- `src/data/queries.ts` — the one query builder. `GET /api/payments` uses `queryPayments`, which adds `paginate` and returns `total`.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` (ten columns, `last4` included), `toCsv(rows, columns = EXPORT_COLUMNS)` already accepts a column list, and `exportFilename(date)` gives `payments-YYYY-MM-DD.csv`.
- `src/lib/csv.test.ts` — pins the escaping, the column contract, the `$250.00` amount format and the filename. It says these tests should still pass after NWP-101.
- **Ticket versus code:** "Amounts stay in minor units internally and are formatted once on the way out, with currency in its own column" is already true. `toCsv` formats through `formatMoney` once, and `currency` is its own column. No change needed.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate them server-side. Do not interpolate them into SQL." | `docs/tickets/NWP-101.md` | Arbitrary client input reaches the serializer |
| "One query builder… A second implementation is a bug, not a shortcut." | app `CLAUDE.md` | Export and table disagree on which rows match |
| "Building this in the browser exports the current page only" | `docs/tickets/NWP-101.md` | Exports silently truncate to 20 rows |
| "checked against an allowlist before it reaches a query, a filename, or the store" | app `CLAUDE.md` | Header injection or path tricks through the filename |
| "Money is integer minor units… Format once, at the edge" | app `CLAUDE.md` | Amounts drift or are formatted twice |
| "Dialogs and forms must be operable" | `.claude/rules/components.md` | Keyboard and screen-reader users cannot export |

## Approach

The export stays on the server. The new drawer only collects choices and turns them into a URL; it never reads table rows. The export route gains two validated parameters, `columns` (a comma list, allowlisted against `EXPORT_COLUMNS`, order kept, duplicates dropped, defaulting to every column except `last4`) and `scope` (`filter` by default, or `all`). Both scopes go through `parseFilters` and `filterPayments`; "all" passes empty params rather than reading the store directly. Invalid input returns `400 { message }` before any data is touched. The filename label is built only from allowlisted values. The drawer gets its row count from `GET /api/payments`, which already returns `total` from the same builder.

**Considered and rejected:**
- **Building the CSV in the browser from the table.** It exports only the visible page, which is the bug the ticket warns about.
- **A new count endpoint.** `GET /api/payments` already returns `total` from the same builder, so a second endpoint would duplicate it.
- **Silently dropping unknown columns.** It hides client bugs and lets a malformed request produce a misleading file. Rejecting with 400 is explicit.
- **Putting merchant or search text in the filename.** That is unvalidated client input, so only the allowlisted status reaches the filename.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, `parseExportScope`, `exportScopeLabel`, optional label on `exportFilename` |
| `src/app/api/payments/export/route.ts` | Change | Validate `columns` and `scope`, return 400 on bad input, scoped filename |
| `src/app/payments/export-dialog.tsx` | Add | Client drawer: column checkboxes, scope radios, row count, Download |
| `src/app/payments/page.tsx` | Change | Replace the `<a>` with the drawer, passing the filters without `page` |
| `src/components/Drawer.tsx` | Change | Give the icon-only close button an accessible name |
| `src/lib/csv.test.ts` | Change | Column order, `last4` off by default, empty selection rejected |

## Plan

1. **Helpers in `csv.ts`** — done when: the existing 28 tests still pass.
2. **Route validation** — done when: `curl` returns 400 for unknown, empty or bad-scope input, and the right columns and filename otherwise.
3. **Drawer and page wiring** — done when: Export opens a labelled drawer, the count changes with scope, and unchecking every column disables Download.
4. **Tests** — done when: `npm test` passes with the three new cases.
5. **Verify** — done when: lint and build are clean, and the curl and browser checks pass.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns, last four off by default | Test: `parseExportColumns(null)` excludes `last4`. Curl with no `columns` has no `last4` header. Drawer opens with it unchecked |
| Choose scope, current filter default, row count visible | Curl `scope=all` returns the full count, and the default matches `total` for the filter. The drawer shows both counts |
| Filename reflects scope and date | Curl `content-disposition` for `status=disputed` gives `payments-disputed-<date>.csv`, and `scope=all` gives `payments-all-<date>.csv` |
| Minor units, formatted once, currency column | Already true. Existing `toCsv` tests still pass |
| No columns disables Download | Test: empty selection is rejected. Route returns 400. Drawer disables Download |
| Not limited to the visible page | Curl: data rows in the export equal `total` from `GET /api/payments`, and exceed the 20 on screen |

## Risks

- **The drawer and route could drift on defaults.** Both import `DEFAULT_EXPORT_COLUMNS` from `csv.ts`.
- **Large "all" exports.** About 1,700 in-memory rows, which is fine here. Streaming is out of scope.

## Out of scope

- Fixing the pre-existing money and date issues in `src/data/metrics.ts` and `analytics.ts`, and the string sort in `sortPayments`. These are separate tickets.
- Making `payments/page.tsx` use `parseFilters`.
- Column reordering in the UI. Columns export in the canonical order.

## Open questions

- Should a zero-row export be blocked as well? It currently downloads a header-only file.

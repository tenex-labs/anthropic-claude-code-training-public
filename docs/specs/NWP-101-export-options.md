# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Jessica Kosturko
**Status:** done

## Problem

Ops exports the payments table several times a day, but every file carries every column, including the card last four. Dana's team spends 3–4 hours a month hand-cleaning files before they go to a merchant, and an unedited file nearly went to the wrong merchant last quarter. Ops needs to choose the columns and the scope before downloading.

## Current state

Paths are relative to `build-battle/merchant-console/`.

- `src/app/payments/page.tsx:68-76`: Export is a plain `<a>` to `/api/payments/export` carrying the page's query string. No dialog, no options.
- `src/app/api/payments/export/route.ts:11-25`: parses filters with `parseFilters()`, then `filterPayments()` + `sortPayments()`. It **skips `paginate()`**, so it already exports every matching row, not just the visible page. Columns and filename are fixed.
- `src/data/queries.ts:18-36`: `parseFilters()` is the existing allowlist for status, sort, direction, and page. `filterPayments()` / `sortPayments()` / `paginate()` / `queryPayments()` are the one query builder (`queries.ts:38-106`).
- `src/lib/csv.ts:13-24`: `EXPORT_COLUMNS` lists all ten columns, `last4` included. `toCsv(payments, columns)` (`csv.ts:58-67`) **already accepts a column subset in a given order**. `exportFilename()` (`csv.ts:69-71`) stamps only the UTC date.
- `src/lib/csv.ts:51-54`: amount is formatted once via `formatMoney()` from minor units, and currency is already its own column. That acceptance criterion already holds and must not regress.
- `src/lib/csv.test.ts`: 9 tests pin escaping and the column contract. The header comment says they should still pass after NWP-101.
- `src/components/Drawer.tsx`: Radix-dialog-based panel with title, description, focus trap, and Escape handling. There is no `Dialog` wrapper in `src/components/`.
- **Mismatch with the ticket:** the ticket warns that a browser-built export would only cover the current page. The server route already avoids that. The work is adding options to it, not rebuilding it.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` | Arbitrary input reaches the serializer or the `content-disposition` header |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug" | `merchant-console/CLAUDE.md` | Row count and file disagree; points lost |
| "Money is integer minor units… Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` | Amounts drift or lose their currency |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | Dialog can't show a useful failure |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Dialog unusable by keyboard or screen reader |
| Card last-four is **off** by default | NWP-101 acceptance criteria | The near-miss repeats |

## Approach

Keep the export on the server and add two validated options to the existing route: `columns` (comma-separated) and `scope` (`filtered` or `all`). Pure parsing and validation live in `src/lib/csv.ts` beside the serializer, so they are unit-testable: unknown or empty column lists are rejected with a 400 and a JSON `{ error }` body, duplicates are dropped, and order is kept. A missing `columns` falls back to a default list without `last4`. `scope=all` runs the same query builder with empty filters. The filename label comes only from validated values: `all`, the allowlisted status, or `filtered`. The Payments page computes both row counts with the same `parseFilters()` + `filterPayments()` path the route uses, so the count shown always matches the file. It passes them to a new client dialog built on the existing `Drawer`, with labelled checkboxes and a scope radio group. Download is disabled when no column is ticked.

**Considered and rejected:**
- Fetching the count from `GET /api/payments` inside the dialog. It costs an extra request and a loading state, and the server page already has the data.
- Silently dropping unknown columns. That hides client bugs, and the API rules say reject early.
- Changing `toCsv()`'s default to drop `last4`. That would break the pinned test contract. The default belongs at the request boundary.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add default column list, column and scope parsing, scope-aware `exportFilename()` |
| `src/app/api/payments/export/route.ts` | change | Read and validate `columns` and `scope`, return 400 on bad input, use the new filename |
| `src/app/payments/export-dialog.tsx` | add | Client dialog: columns, scope, row count, Download |
| `src/app/payments/page.tsx` | change | Swap the Export link for the dialog. Parse filters once with `parseFilters()` for the table, the panel's counts and the export, replacing the hand-built parse |
| `src/components/Drawer.tsx` | change | Give the icon-only close button an accessible name (found by `/ship-ready`). The export dialog inherits it |
| `src/lib/csv.test.ts` | change | Tests for column selection, the default, an empty selection, scope, and filename |

## Plan

1. **CSV helpers and route validation.** Done when: `curl` with unknown or empty `columns` returns 400 JSON, with no `columns` returns 9 columns and no `last4`, and `scope=all` returns every payment with the right filename.
2. **Options dialog.** Done when: Export opens a labelled panel, its close button announces "Close", both counts show, Download builds the right URL, and unticking everything disables Download.
3. **First `npm test` run.** Done when: the existing 28 tests still pass.
4. **New tests in `src/lib/csv.test.ts`.** Cover a subset in the requested order, last four excluded by default, empty selection rejected, plus scope and filename. Done when: a second `npm test` passes.
5. **Typecheck, lint, browser check.** Done when: `npx tsc --noEmit` and `npm run lint` are clean and a real download from the dialog matches its count.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns, last-four off by default | Unit test on the default list; dialog opens with last-four unticked; `curl` without `columns` has no `last4` header |
| Scope: current filter (default) or all, row count visible | Dialog defaults to current filter and shows both counts; `curl` line counts match them |
| Filename reflects scope and date | Unit tests on `exportFilename()`; `content-disposition` header via `curl -I` |
| Minor units internally, formatted once, currency column | Existing `toCsv` amount tests still pass, unchanged |
| No columns disables Download | Dialog check in the browser; route returns 400 as the backstop, covered by a unit test |
| Unit test on the column serializer, `npm test` passes | Two `npm test` runs, summary shown |

## Risks

- **Count and file disagree** if the page and route parse filters differently. Mitigation: the page and the route both use `parseFilters()`, and the table total is the panel's "current filter" count.
- **Filename injection** through the `content-disposition` header. Mitigation: the label is only ever `all`, `filtered`, or an allowlisted status.

## Out of scope

- `sortPayments()` compares amounts as strings (`src/data/queries.ts:79-82`), so amount-sorted exports are misordered. A real bug, but a separate fix.
- Per-user saved column presets and other export formats.

## Open questions

- Should "current filter" with no filters applied be labelled `filtered` or `all` in the filename? Proposed: `filtered`, because it tells the reader which option was picked.

## Decision log

- **2026-11-17: the Payments page now parses filters with `parseFilters()`.** This was originally out of scope. The org-standards review (#3, #6) and `/code-review` both found that the table total and the export panel's count were derived two ways. With a date filter in the address, the table showed 1,658 payments while the panel and file showed 167. Moved in scope because this PR introduced the second number.

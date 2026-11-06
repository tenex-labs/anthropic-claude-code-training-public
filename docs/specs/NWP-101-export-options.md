# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** JaredOnAnIsland
**Status:** done

## Problem

Ops exports the payments table several times a day, but the export is fixed: every column, current filter only. The card last four is in every file, so anything sent to a merchant has to be cleaned by hand first. Dana's team spends 3–4 hours a month on that editing, and an unedited file nearly went to the wrong merchant last quarter.

## Current state

Paths are under `build-battle/merchant-console/`.

- `src/app/payments/page.tsx:68` — the Export button is a plain link to `/api/payments/export` carrying the page's query string, `page` included. No dialog, no row count.
- `src/app/payments/page.tsx:36` — the page builds its own filters with its own status list instead of calling `parseFilters`, and ignores `sort`, `from` and `to`. The export honors them, so the two can disagree.
- `src/app/api/payments/export/route.ts:11` — runs `parseFilters`, `filterPayments` and `sortPayments`, never `paginate`. Verified against the dev server: 1,658 rows unfiltered, 33 for `status=disputed`, whatever `page` says.
- `src/data/queries.ts:18` — `parseFilters` allowlists status, sort and direction. `merchantId`, `search`, `from` and `to` pass through as raw strings.
- `src/lib/csv.ts:13` — `EXPORT_COLUMNS`, ten columns including `last4`. `toCsv` (`:58`) already accepts a column list, covered by `src/lib/csv.test.ts:32`.
- `src/lib/csv.ts:51` — `amount` is formatted once by `formatMoney`, and `currency` is already its own column. The existing tests pin this format.
- `src/lib/csv.ts:69` — `exportFilename` stamps the UTC date only: `payments-2026-11-06.csv`.
- `src/components/` — there is no Dialog, although `.claude/rules/components.md` lists one. `Drawer.tsx` wraps the same `@radix-ui/react-dialog` primitive.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from a client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `docs/ORG-STANDARDS.md` #7 | Arbitrary text in `Content-Disposition`, unknown columns |
| "Do not interpolate them into SQL." Column names are validated server-side. | Ticket notes | Same |
| "Filtering and sorting go through the shared builder." | `docs/ORG-STANDARDS.md` #6 | "All payments" and the row count drift from the table |
| "Building this in the browser exports the current page only." | Ticket notes | Ships the bug instead of the feature |
| "Format once, at the edge." | `docs/ORG-STANDARDS.md` #2 | Amounts double-formatted or parsed back |
| "Return the same error shape everywhere." | `.claude/rules/api-routes.md` | Each failure looks different to the client |
| "Dialogs and forms must be operable." | `.claude/rules/components.md` | Keyboard and screen-reader users cannot export |

## Approach

Keep the server in charge. The export route accepts two new parameters, `columns` and `scope`, checks both against allowlists in `src/lib/csv.ts` before touching the store, and answers bad input with a 400 and `{ error }`. Rows still come from the shared query builder: `filtered` uses the parsed filters, `all` drops them but keeps the sort. The filename gains a label built only from allowlisted values. The browser side is a client component on the existing `Drawer` that collects the choices and links to the route. The page reads its filters through `parseFilters`, so the count it shows is the count exported.

**Considered and rejected:** building the CSV in the browser from the table, which exports one page of 20 (the ticket warns against it). Adding a new Dialog primitive when `Drawer` already wraps the same Radix dialog. Changing how `amount` is written, which the ticket does not require and the existing tests pin.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Default column set without `last4`; parse and allowlist `columns` and `scope`; filename label |
| `src/app/api/payments/export/route.ts` | Change | Validate early, apply scope, pass the chosen columns and label |
| `src/app/payments/export-dialog.tsx` | Add | Column checkboxes, scope choice with row counts, Download |
| `src/app/payments/page.tsx` | Change | Use `parseFilters`; render the dialog with both counts |
| `src/lib/csv.test.ts` | Change | Column selection, defaults, empty and unknown selections, filename label |

## Plan

1. **Validation helpers in `csv.ts`** — done when: unknown, empty and default column lists resolve as specified, and the existing 28 tests still pass.
2. **Route handler** — done when: `curl` shows the default header without `last4`, the requested column order, 400s for bad input, and scoped filenames.
3. **Dialog and page** — done when: the dialog opens from Export, shows both counts, and Download is disabled with no columns.
4. **Tests** — done when: new cases in `csv.test.ts` pass with `npm test`, alongside lint and `tsc`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last four off by default | Unit tests on the default set and on a subset in requested order; `curl` default header; dialog opens with last four unchecked |
| Choose scope; current filter default; count visible | `curl` with `status=disputed` gives 33 rows, with `scope=all` 1,658; dialog shows both counts |
| Filename reflects scope and date | Unit test on the label; `curl` shows `payments-disputed-<date>.csv` and `payments-all-<date>.csv` |
| Minor units inside, formatted once, currency own column | Unchanged `cell()`; existing amount tests still pass |
| No columns disables Download | Dialog check in Chrome; server rejects an empty list with 400, covered by a unit test |

## Risks

- `parseFilters` passes `merchantId` through unchecked. The filename uses it only when the merchant exists, and never uses search text or dates.
- The page switching to `parseFilters` means `sort`, `from` and `to` in the URL now affect the table too, matching the export.

## Out of scope

- Amount sort compares as text (`src/data/queries.ts:81`). Separate fix.
- The `to` date excludes its own day (`src/data/queries.ts:53`). Separate fix.
- Persistence, saved export presets.

## Open questions

- None blocking. The filename uses `filtered` when a search or date range is applied, rather than the values themselves.

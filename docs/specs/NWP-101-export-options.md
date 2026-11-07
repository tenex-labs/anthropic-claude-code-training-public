# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Miguel
**Status:** built, not yet committed (v3 approved by Miguel; after seeing it built he switched the side panel to a centred modal)

## Problem

Ops exports the payments table several times a day. The export is fixed: every column, current filter only.

- Card last four ships in every file, so files headed to a merchant are cleaned by hand. That costs 3–4 h a month.
- Last quarter one unedited file nearly went to the wrong merchant.

## Current state

Paths are relative to `build-battle/merchant-console/`.

**The export today**

- `src/app/payments/page.tsx:68-76`: the Export button is a plain `<a href="/api/payments/export?<current query>">`. There is no dialog and there are no options. The forwarded query includes `page=N`.
- `src/app/api/payments/export/route.ts`: the export already runs on the server and already reuses the query builder: `parseFilters` → `filterPayments` → `sortPayments`.
  - It exports every filtered row, not one page, so it already avoids the pagination trap the ticket warns about.
  - It always calls `toCsv(rows)` with every column, and `exportFilename()` without a scope.
  - The header comment says "column set is fixed … NWP-101". It will be updated.
- `src/lib/csv.ts`:
  - `EXPORT_COLUMNS` has 10 columns, `last4` included.
  - `toCsv(payments, columns = EXPORT_COLUMNS)` already writes a subset in the order given. With `columns = []` it writes a file of blank lines (`csv.ts:58-67`), which is exactly what AC 5 forbids.
  - `exportFilename(date)` returns `payments-YYYY-MM-DD.csv` from the UTC date.
  - The header comment is out of date in the same way as the route's.
- `src/lib/csv.ts:51-54`: `amount` is `formatMoney(minor, currency)` and `currency` has its own column. Amounts stay in minor units internally and are formatted once on the way out. That AC already holds and must not regress.
- `src/lib/csv.ts:28-31`: `escapeCell` handles quotes, commas and newlines. It does **not** neutralise spreadsheet formulas, meaning cells that start with `=`, `+`, `-` or `@` (see Risks).
- `src/lib/csv.test.ts`: 9 tests covering escaping, the column contract and `exportFilename(date)` (lines 79-85). New tests go here.

**Filtering and data**

- `src/data/queries.ts`:
  - `parseFilters` (line 18) is the allowlist for filter params. It passes `merchantId` and `search` through unchecked and untrimmed.
  - `filterPayments` trims `search` (line 47).
- `src/data/merchants.ts`: `merchants` (`mch_01` is "Lumen Coffee Roasters") and `merchantById`. This is server data, so a name looked up by id is trusted.
- `src/app/payments/page.tsx:36-43`: the table builds its filters by hand instead of calling `parseFilters`, and ignores `from`, `to`, `sort` and `direction`.

**Components**

- `src/components/` has no `Dialog.tsx`, although `.claude/rules/components.md` lists one.
- `Drawer.tsx` is a Radix Dialog drawn as a panel that slides in from the right.
  - Size: `max-w-lg` on desktop; `w-[95vw]` with a small inset on mobile.
  - It is already used for the mobile sidebar (`Sidebar.tsx:139-160`).
  - It has no `"use client"`, so it must be imported from a client component.
  - `DrawerHeader` always renders a ✕ close button before the body. That button has no accessible name: the icon is `aria-hidden` and there is no text.
- There is no Checkbox or Radio component, and `package.json` has no package for either.
- `Button` with `disabled` sets the native attribute (`Button.tsx:122`).
- There is no slug helper (searched `src/` for `slug` and `kebab`).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from the client — column names … — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` §4 | Arbitrary columns; header injection through `content-disposition` |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug." | `merchant-console/CLAUDE.md` §3 | The export and the count disagree about which rows match |
| "Money is integer minor units … Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` §1 | Amounts drift or are formatted twice |
| "Return the same error shape everywhere: a status code … and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | The UI cannot explain a failure |
| "Dialogs and forms must be operable … accessible name, focus moves into it and returns on close, Escape closes it." / "Every input has a label." | `.claude/rules/components.md` | The dialog cannot be used from the keyboard |
| "Use what is here … before adding a dependency." / "Tailwind only." | `.claude/rules/components.md` | A second dialog primitive; new packages; inline styles |

## Approach

The server stays the single source of truth for which rows, which columns and which filename. The panel only picks options and shows what the server will produce.

### Server pieces in `src/lib/csv.ts`

All of these are pure, and every one is tested in `csv.test.ts`.

- `DEFAULT_EXPORT_COLUMNS`: `EXPORT_COLUMNS` without `last4`.
- `COLUMN_LABELS: Record<ExportColumn, string>` for the checkbox labels.
- `parseExportColumns(raw: string | null)` returns `{ columns } | { error }`.
  - A missing value (`null`) gives the defaults.
  - Otherwise the value is split on `,`, with no trimming and no case folding.
  - Empty input, an empty segment, an unknown column or a repeated column is rejected.
  - The columns come back in the requested order.
- `parseExportScope(raw)`: `null` gives `"current"`. `"current"` and `"all"` are accepted. Anything else is rejected.
- **`parseExportRequest(params: URLSearchParams)`** returns `{ columns, filters, filename } | { error }`. This is the whole validation the route runs, kept pure so it can be tested here without spinning up the route:
  1. Run `parseExportColumns` and `parseExportScope`. On an error, return the error.
  2. Build the filters:
     - `scope=all`: `parseFilters(new URLSearchParams())`. This still goes through the allowlist and never uses a hand-built object.
     - `scope=current`: `parseFilters(params)`.
  3. Compute the filename with `exportFilename(new Date(), { scope, filters })`.
- `toCsv` gains one guard: an empty `columns` array throws a `RangeError`. The serializer can never produce the "empty file" that AC 5 forbids, even if a caller skips validation.
- `exportFilename(date = new Date(), opts?)` keeps its current signature, so the existing test is untouched. The optional `opts` is `{ scope, filters }`.
- `slugify(name)` is private. It lowercases the name, turns every run of characters outside `[a-z0-9]` into `-`, and trims leading and trailing `-`. It is only ever applied to a merchant name from `merchantById`.

### Route `src/app/api/payments/export/route.ts`

The route is a thin wrapper:

1. Call `parseExportRequest(request.nextUrl.searchParams)`. On an error, return `400` with `{ error: string }`. This becomes the route-handler error shape, since no other route returns errors yet.
2. Otherwise run `filterPayments` → `sortPayments` as today and return `toCsv(rows, columns)` under `filename`.

The header comments in both files are updated.

### Filename

The name is built from segments `[merchant, status, filtered]` joined with `-`. If there are no segments, the name uses `all`. With `scope=all`, every segment is dropped.

- **merchant**: `slugify(merchantById(id).name)` when the id exists. An empty slug is dropped.
- **status**: the status when it is not `all`. It is already allowlisted.
- **filtered**: added when `search?.trim()` is not empty, when `from` or `to` is set, or when `merchantId` is set but unknown. An unknown id still filters, to zero rows, so the file must not be called "all".

| Request | Filename |
| --- | --- |
| no `opts` (old callers, existing test) | `payments-<date>.csv` |
| `scope=all` (filters in the URL ignored) | `payments-all-<date>.csv` |
| current, `status=disputed` | `payments-disputed-<date>.csv` |
| current, `merchantId=mch_01` | `payments-lumen-coffee-roasters-<date>.csv` |
| current, `merchantId=mch_01&status=disputed` | `payments-lumen-coffee-roasters-disputed-<date>.csv` |
| current, `search=1180` | `payments-filtered-<date>.csv` |
| current, `search=%20%20` (blank) | `payments-all-<date>.csv` (blank search filters nothing) |
| current, `merchantId=mch_unknown` | `payments-filtered-<date>.csv` |
| current, no filters | `payments-all-<date>.csv` (same rows as all, so the name is truthful) |

Raw client text, such as `search` or an unknown `merchantId`, never reaches the filename.

The `filtered` segment is my own call; nobody asked for it. Without it, a search export would be named `payments-all`, which would be false.

## Options panel: how it is built

### Placement and flow

1. The Export button on `/payments` keeps its place and look: a secondary button with the Download icon, top right, next to the filters. It becomes the `DrawerTrigger` and no longer downloads directly.
2. Clicking it opens the options panel. It slides in from the right over a dimmed page. On mobile it takes almost the full width. Focus moves to the first column checkbox, sent there explicitly with `onOpenAutoFocus` on `DrawerContent`. Without that, Radix would focus the ✕.
3. Ops adjusts the columns and the scope, and the summary line updates as they go.
4. **Download** starts the file through a normal link, and the panel closes. Focus returns to Export.
   - The close is deferred with `setTimeout(0)` after the click, so the link's navigation is not cut off.
   - Step 4 of the plan confirms the file actually arrives.
5. **Cancel**, the ✕, Escape or a click on the overlay all close the panel without downloading.

**Open for Miguel:** this is a side panel (the existing `Drawer`), not a window centred on the screen. A centred modal would mean writing a new `Dialog.tsx` on the same Radix base, about 60 lines that copy `Drawer` with different classes. Either works; the panel reuses what the repo already has.

### Wireframe

```
┌────────────────────────────────────────────┐
│ Export payments                         ✕  │  DrawerHeader: DrawerTitle
│ Choose what goes into the CSV.             │               DrawerDescription
├────────────────────────────────────────────┤
│ Columns                                    │  fieldset/legend
│ ☑ Payment ID          ☑ Created (UTC)      │  2-column grid on sm+, 1 on mobile
│ ☑ Merchant            ☑ Description        │
│ ☑ Status              ☑ Method             │
│ ☑ Card brand          ☐ Card last four     │  unchecked by default
│ ☑ Amount              ☑ Currency           │
│   Last four is off by default for files    │  hint under the last4 checkbox
│   that go to merchants.                    │
│                                            │
│ Scope                                      │  fieldset/legend
│ ◉ Current filter · 83 payments             │  radio; count from props
│ ○ All payments · 1,658 payments            │
│                                            │
│ 83 rows · 9 columns                        │  live summary (aria-live)
│ payments-lumen-coffee-roasters-disputed-   │  filename preview (monospace)
│   2026-11-07.csv                           │
├────────────────────────────────────────────┤
│                       [Cancel] [Download]  │  DrawerFooter; Download = primary
└────────────────────────────────────────────┘
  0 columns: Download looks disabled + "Select at least one column."
  0 rows: count reads "0 payments"; Download still works and gives a header-only CSV.
```

### Components and data

| Piece | Built with | Notes |
| --- | --- | --- |
| Panel shell | `Drawer`, `DrawerTrigger asChild`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerBody`, `DrawerFooter`, `DrawerClose` | All existing |
| ✕ accessible name | one-line change in `Drawer.tsx`: `<span className="sr-only">Close</span>` inside the header's close button | Also fixes the mobile sidebar's ✕ |
| Trigger | existing `Button variant="secondary"` with the `Download` icon from `lucide-react` | Same look as today |
| Column checkboxes | native `<input type="checkbox">` inside `<label>`, one per `EXPORT_COLUMNS` entry, text from `COLUMN_LABELS` | Tailwind only; `fieldset`/`legend` "Columns" |
| Scope radios | native `<input type="radio" name="scope">` inside `<label>` | `fieldset`/`legend` "Scope" |
| Download (enabled) | `Button variant="primary" asChild` wrapping `<a href download>` | |
| Download (no columns) | `Button` with `aria-disabled="true"`, a click that does nothing, and disabled styling. The native `disabled` attribute is **not** used. | The button stays focusable, so `aria-describedby` reads the hint aloud |
| Cancel | `DrawerClose asChild` with `Button variant="secondary"` | |

`page.tsx` is a server component, so it computes what the panel shows and passes it down. The panel does no fetching, which means it has no loading or error states.

```ts
type ExportDialogProps = {
  query: string                                 // URL params with page, scope, columns deleted
  counts: { current: number; all: number }      // filterPayments(parseFilters(...)).length
  filenames: { current: string; all: string }   // same exportFilename the route uses
}
```

- **Client state.** The panel lives in `src/app/payments/export-dialog.tsx` (`"use client"`). It holds:
  - `open`, a controlled boolean;
  - `selected: Set<ExportColumn>`, starting from `DEFAULT_EXPORT_COLUMNS`;
  - `scope: "current" | "all"`, starting at `"current"`.

  The selection lives while the page is mounted. A reload resets it to the defaults.
- **Column order.** The CSV always follows the canonical `EXPORT_COLUMNS` order, filtered to `selected`. It does not depend on click order, so files stay comparable between exports.
- **Download href.** Take a copy of `query`, then `set("scope", …)` and `set("columns", …)`, with columns in canonical order joined by `,`. Prefix with `/api/payments/export?`. `page.tsx` has already deleted `page`, `scope` and `columns` from the copy it passes in, so old values cannot win.
- **The preview** shows `filenames[scope]`.

### Accessibility checklist

- The panel is named by `DrawerTitle` ("Export payments") and described by `DrawerDescription`.
- On open, focus goes to the first checkbox (`onOpenAutoFocus`). On close it returns to Export. Escape closes the panel.
- Every input has a visible `<label>` and every group has a `legend`. The ✕ is named "Close".
- The no-columns Download stays focusable with `aria-disabled`. Its hint is linked through `aria-describedby`.
- The summary line is `aria-live="polite"`.

**Considered and rejected:**
- *Build the CSV in the browser from table data.* It would export only the visible page of 20 rows, which is the bug the ticket warns about.
- *Fetch the count from `GET /api/payments` when the panel opens.* That needs loading and error states and can drift from the page. Counts passed as props from the server page use the same builder.
- *A route test with `NextRequest`.* All the route's decisions live in `parseExportRequest`, which is tested directly in `csv.test.ts`. The route itself is checked with curl in step 1.
- *Silently drop unknown column names.* That hides client bugs. A 400 is better.
- *Add `@radix-ui/react-checkbox` or a radio-group package.* Native inputs with labels meet the rule.
- *A readable "active filters" summary in the panel.* Nobody asked for it, and the filter bar and the filename preview already say it.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add `DEFAULT_EXPORT_COLUMNS`, `COLUMN_LABELS`, `parseExportColumns`, `parseExportScope`, `parseExportRequest` and the private `slugify`. Add the optional `opts` to `exportFilename` and the empty-columns guard to `toCsv`. Update the header comment. |
| `src/app/api/payments/export/route.ts` | change | Call `parseExportRequest`, return `400 { error }` on bad input, and stream the CSV with the returned columns and filename. Update the header comment. |
| `src/components/Drawer.tsx` | change | Add `sr-only` "Close" text to the header ✕ (one line) |
| `src/app/payments/export-dialog.tsx` | add | The options panel described above |
| `src/app/payments/page.tsx` | change | Compute `counts`, `filenames`, and `query` with `page`, `scope` and `columns` removed. Render `<ExportDialog …/>` in place of the `<a>`. |
| `src/lib/csv.test.ts` | change | Add the new tests. The existing 9 stay and keep passing. |
| `docs/tickets/BACKLOG.md` (repo root) | change | Add NWP-206 for the `sortPayments` amount bug |

## Plan

The dev server is already running on `localhost:3000`. Steps 1, 2 and 4 use it.

0. **Baseline.** Run `npm test` before touching anything and keep the summary.
1. **csv helpers and route.** Done when:
   - `curl -i '…/api/payments/export?columns=id,amount&status=disputed'` returns 2 columns, `filename="payments-disputed-<today>.csv"` and only disputed rows;
   - `…&merchantId=mch_01&status=disputed` is named `payments-lumen-coffee-roasters-disputed-<today>.csv`;
   - `columns=`, `columns=id,bogus`, `columns=id,id` and `scope=nope` each return 400 with `{"error": …}`;
   - no `columns` param returns every column except `last4`;
   - `scope=all&status=disputed` returns every row, named `payments-all-…`.
2. **Options panel.** Done when, on `/payments`:
   - Export opens a panel named "Export payments", with focus on the first checkbox.
   - Card last four is unchecked and Current filter is selected.
   - The counts and the filename preview match the active filter.
   - Switching the scope updates the count and the filename.
   - Unchecking every column makes Download inert (still focusable) and shows the hint.
   - Escape and Cancel close the panel and return focus to Export.
   - At mobile width (375 px) there is no horizontal scroll.
3. **Tests.** Run `npm test`. That is the summary after the code change and before the new tests.

   Add to `csv.test.ts`:
   - a subset of columns in the requested order (`parseExportColumns` and `toCsv`);
   - the default selection excludes `last4`;
   - an empty selection: `parseExportColumns("")` is rejected **and** `toCsv(rows, [])` throws;
   - unknown and duplicate columns are rejected;
   - a missing param gives the defaults;
   - `parseExportRequest` with `scope=all&status=disputed` ignores the status in both the filters and the filename;
   - `exportFilename` for every row of the filename table.

   Run `npm test` again. Done when everything passes and all three summaries (step 0, before the new tests, after) are shown to the user.
4. **Browser check.**
   - With the `disputed` and Lumen filters, download from the panel. Done when the file arrives, its name equals the preview, there is no `last4` header, and its data rows equal the panel's count.
   - Repeat with All payments.
   - Take screenshots of the panel, including the no-columns state. The console must be clean.
5. **Backlog.** Add **NWP-206 · Sorting payments by amount sorts as text** to `docs/tickets/BACKLOG.md`. The bug: `sortPayments` compares `String(amount)` (`queries.ts:81`), so `10000` sorts before `2500` in the table and in the export whenever `sort=amount`. Done when the entry exists and this spec links to it.
6. **Ship.** Run `/ship-ready`, commit as `NWP-101: …` on `NWP-101-export-options`, then run `/pr` with the Verification table as evidence. The commit, the push and opening the PR each wait for Miguel's go-ahead.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns, last four off by default | Unit test: the defaults exclude `last4`. The checkbox is unchecked when the panel opens. The downloaded header has no `last4`. |
| Scope current or all, current by default, row count visible | The panel shows a count for each scope, and the data rows in the downloaded file equal the count shown |
| Filename reflects scope and date | Unit tests for every row of the filename table. The `content-disposition` header from curl. The preview equals the downloaded name. |
| Minor units internal, formatted once, currency in its own column | The existing `toCsv` amount tests stay green, and `currency` remains its own column |
| Zero columns disables Download | Browser check with a screenshot. The server rejects `columns=` with 400, and `toCsv(rows, [])` throws (both unit-tested). |
| Server-side validation, never interpolated | Allowlist tests for unknown and duplicate columns. `parseExportRequest` is tested. The filename is built only from allowlisted values and server-side merchant names. |

## Risks

- **The panel count can differ from the table footer** when the URL carries `from`, `to`, `sort` or `direction`, because the table builds its filters by hand (`page.tsx:36-43`). The count and the export both use `parseFilters`, so the count always matches the file. The footer drift is existing behaviour.
- **The store can change between page render and Download**, because refunds write to it. The count and the preview can then be off by one row. A reload refreshes them.
- **The preview date can differ from the download date** across midnight UTC.
- **Spreadsheet formula injection.** `escapeCell` does not neutralise cells that start with `=`, `+`, `-` or `@`. Today every description is generated data, so the real risk is low. This is known and not fixed in this ticket.
- **A hand-crafted bad URL shows a raw JSON error page.** This is accepted because the UI cannot produce one.

## Out of scope

- [NWP-206](../tickets/BACKLOG.md#nwp-206--sorting-payments-by-amount-sorts-as-text): sorting by amount sorts as text. It is logged in step 5.
- [NWP-207](../tickets/BACKLOG.md#nwp-207--payments-table-builds-its-own-filters): the table footer ignores `from` and `to` because the page builds its own filters (see Risks).
- CSV formula injection (see Risks).
- Persisting the chosen columns between sessions, and NWP-102.

## Open questions

- None. Miguel first picked the side panel, then, after seeing it built, asked for a centred floating window. See the build notes.

## Build notes (deviations from the plan)

- `csv.ts` now imports `parseFilters`, which pulls in the store, so it is server-only. To keep the client panel from importing it, `page.tsx` passes the column list as a prop (`columns: { id, label, defaultOn }[]`) and the panel imports only types from `csv.ts`.
- `filtersForScope(scope, params)` is exported from `csv.ts` so the page counts and the route use the same scope logic.
- **Centred modal instead of the side panel (Miguel's call after seeing it).** New `src/components/Dialog.tsx`: the same Radix primitive and the same API shape as `Drawer` (`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader` with a named ✕, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`, `DialogClose`).
  - The overlay is a `grid place-items-center` layer, so the content stays centred while its own transform is used by the existing `slideUpAndFade` animation. `tailwind.config.ts` is unchanged.
  - Height is capped at `100dvh - 2rem` and scrolls inside.
  - It also fills the `Dialog` that `.claude/rules/components.md` already lists.
  - The `Drawer.tsx` change (the ✕ named "Close") stays, because it fixes the mobile sidebar.
- The validators return `{ ok: true, value } | { ok: false, error }` rather than `{ columns } | { error }`. The behaviour is the same.

## Review

- **Tests:** `npm test` at baseline gave 28/28. After the code change, before the new tests, it was still 28/28. After the new tests it was **46/46**: csv went from 9 to 27, and the 9 originals are untouched. `tsc --noEmit` and `next lint` are clean.
- **curl:**
  - `columns=id,amount&status=disputed` returns 2 columns, `payments-disputed-2026-11-07.csv` and 33 rows.
  - `merchantId=mch_01&status=disputed` returns `payments-lumen-coffee-roasters-disputed-2026-11-07.csv` with no `last4`.
  - `scope=all&status=disputed` returns 1,658 rows as `payments-all-…`.
  - `columns=`, `columns=id,bogus`, `columns=id,id` and `scope=nope` each return 400 with `{error}`.
- **Browser:**
  - The panel is named "Export payments", focus lands on the first checkbox, last four is off and Current filter is selected.
  - The counts are 5 for the current filter and 1,658 for all. Each export link returns exactly that many data rows under the previewed filename.
  - With zero columns, Download is `aria-disabled`, still focusable and described by the hint.
  - Escape closes the panel and focus returns to Export.
  - At 375 px there is no horizontal scroll.
  - The console is clean.
- **Centred modal (re-checked):**
  - Desktop: the window is centred, with 373 px on each side and 329 px top and bottom, and the backdrop is dimmed (`rgba(0,0,0,.3)`).
  - The name, the focus on the first checkbox, Escape, focus return and closing on a backdrop click all work.
  - At 375 px it sits 16 px from each side with no horizontal scroll.
  - After a clean reload the console has no errors. The earlier errors came from hot reloads during the rename.
- **Not checked:** I did not click the real Download link, which would save a file to the machine. Its href was fetched and checked instead, so the close-after-click timing is untested in a real download.

---

**Revisión goldfish (v1):** 21 avisos, 19 corregidos, 2 para decidir. Miguel aprobó los dos: NWP-206 y el comercio en el nombre del fichero.

**Revisión goldfish (v2):** 19 avisos de 3 revisores, con solapes. 16 corregidos y 3 para decidir.

Corregidos:
- El foco va al primer checkbox, y la ✕ tiene nombre accesible.
- `aria-disabled` en lugar de `disabled`.
- La validación pasa a `parseExportRequest`, que se puede probar.
- `toCsv` rechaza una lista de columnas vacía.
- `search` se recorta antes de decidir el nombre.
- Un `merchantId` desconocido da `filtered`.
- Se quitan `scope` y `columns` de la query.
- Se quita `filterSummary`.
- El cierre de la descarga se aplaza un instante.
- El criterio de móvil es realista.
- Se corrige la frase que decía que el `Drawer` no se usaba.
- Inyección de fórmulas: queda como riesgo conocido.
- Hay una línea base real de los tests antes del paso 1.
- El segmento `filtered` queda marcado como decisión del autor.

Para decidir:
1. Panel lateral o modal centrado.
2. ¿Ticket NWP-207 para que la tabla use `parseFilters`?
3. ¿Se mantiene la vista previa del nombre del fichero? El ticket no la pide.

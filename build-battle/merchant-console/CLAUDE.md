# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

- `npm install`, then `npm run dev`: http://localhost:3000. No database, no seed step, no Docker.
- `npm test`: Vitest, Node environment (no DOM), runs `src/**/*.test.ts`
- `npx vitest run src/lib/csv.test.ts`: one file
- `npx vitest run -t "quotes cells"`: one test, matched by name
- `npm run lint`: `next lint` (next/core-web-vitals)
- `npx tsc --noEmit`: type-check (there is no npm script for it)
- `npm run build`

Tests need Node 20.19 or newer. On older Node, `npm test` stops with `ERR_REQUIRE_ESM` before any test runs.

## Data lives in memory

Data is generated in code at boot by `src/data/generate.ts` and held in the store module, `src/data/store.ts`. Pages and route handlers read and write that store.

- Generation uses a fixed seed, so every machine gets identical records. They cover 120 days ending at `GENERATED_AT` (2026-08-13 UTC), and the dashboards anchor their date ranges to that date, not the wall clock.
- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, change `generate.ts`. Never edit seed data to make a failing case disappear.

## Where the rest of the context lives

This file loads every session, so it stays short. Detail that only matters once you open a particular kind of file lives in `.claude/rules/` and loads when you do:

| Rule | Applies to |
| --- | --- |
| `money.md` | `src/lib/`, `src/app/api/`, `src/data/` |
| `api-routes.md` | `src/app/api/` |
| `cards.md` | anything card-related |
| `components.md` | `src/components/`, `src/app/` |

## Conventions

These four explain most of the code, and breaking them is how bugs get in here.

1. **Money is integer minor units.** `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge, next to its currency code.
2. **Storage and bucketing are UTC.** Display converts to the merchant's timezone. Nothing else does.
3. **One query builder.** Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut.
4. **Validate on the server.** Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store.

## Card rules

- Generated numbers use the `4242` test BIN and a valid Luhn check digit. Nothing here may resemble a real PAN.
- The full number is returned exactly once, in the creation response. After that, last four only.
- Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Console routes: overview, payments, disputes, payouts. Cards is NWP-201 and does not exist yet |
| `src/app/api/` | Route handlers |
| `src/data/` | The data generator, the in-memory store, the query builder (`queries.ts`), dashboard metrics, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

`@/*` maps to `src/*`.

## How data flows

- Pages in `src/app` are async server components. They import from `src/data` directly; they do not call the API routes.
- Filter state lives in the URL. `src/app/payments/filter-bar.tsx` is the client component that rewrites it.
- `src/data/queries.ts` is the query builder: `parseFilters` (checks URL values against an allowlist) → `filterPayments` → `sortPayments` → `paginate`. `queryPayments` runs all of them.
- `GET /api/payments` runs `parseFilters` + `queryPayments` and returns JSON.
- `/api/payments/export` runs `parseFilters` + `filterPayments` + `sortPayments` with no pagination, then `toCsv` and `exportFilename` in `src/lib/csv.ts`.
- `/overview` dashboards aggregate `store.payments` in `src/data/metrics.ts` and `src/data/analytics.ts`.
- The store sits on `globalThis` so it survives hot reload.

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.

## Release Standards

- Every change needs test evidence before it merges.
- No direct commits to `main`. Work on a branch and merge through a pull request.
- Every PR includes a one-line business impact summary.

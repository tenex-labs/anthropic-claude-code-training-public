# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

```bash
npm install
npm run dev                              # http://localhost:3000 (/ redirects to /overview)
npm test                                 # vitest run, node environment, under a second
npx vitest run src/lib/csv.test.ts       # one file
npx vitest run -t "quotes cells"         # one test, by name
npm run lint                             # eslint src (Next 16 removed `next lint`)
npm run build                            # also type-checks
```

No database, no seed step, no Docker. Tests are plain Node with no DOM, and only `src/**/*.test.ts` is collected, so component tests are not set up.

`next dev` writes an untracked `AGENTS.md` here on startup. Do not commit it; `agentRules: false` in `next.config.ts` turns it off.

## Data lives in memory

Seed data is JSON, loaded into a store module at boot. Route handlers read and write that store.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, add it to the JSON. Never edit seed data to make a failing case disappear.

## How the pieces fit

Pages and route handlers are both thin. Server-component pages (`src/app/*/page.tsx`) and `src/app/api/**` handlers call straight into `src/data/` against the in-memory store. There is no HTTP hop between a page and its data.

Payments are the one shared path. Routes call `validateFilterParams` first (400 on an unknown merchant, a non-UTC date or an over-long search, since dropping those would widen the result), then `parseFilters` (allowlists the URL params) → `filterPayments` → `sortPayments` → `paginate` in `src/data/queries.ts`; `queryPayments` composes all four. `GET /api/payments` and `GET /api/payments/export` both go through it, and `/payments` calls `queryPayments`. `filterPayments` does not paginate, so a server-side export covers every matching row. Serialization is `toCsv` in `src/lib/csv.ts`, which formats amounts through `formatMoney` in `src/lib/money.ts`.

Known rough edges, worth knowing before you trust them:

- `payments/page.tsx` keeps its own status allowlist and builds its filters by hand instead of calling `parseFilters`.
- `sortPayments` sorts `amount` with a string compare, so the order is lexicographic. The UI never sets `sort`, so nothing hits it today.
- The `/payments` Export button opens `export-dialog.tsx`, which only builds a URL for `GET /api/payments/export` (validated `columns` and `scope`). The file is always made on the server. Never build it from table rows, which are one page.

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
| `src/data/` | Seed JSON, the in-memory store, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.

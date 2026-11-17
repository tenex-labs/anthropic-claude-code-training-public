# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

Run from `build-battle/merchant-console/`. No database, no seed step, no Docker.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | Vitest, node environment, no DOM; runs `src/**/*.test.ts` |
| `npx vitest run src/lib/csv.test.ts` | One test file |
| `npx vitest run -t "<name>"` | Tests whose name matches |
| `npm run lint` | `next lint` |
| `npm run build` | Production build, which also type-checks |

## Data lives in memory

Seed data is JSON, loaded into a store module at boot. Route handlers read and write that store.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, add it to the JSON. Never edit seed data to make a failing case disappear.

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

## How a request flows

- Console pages are server components that call `src/data/queries.ts` directly. They do not `fetch` from `/api`; the only link to it is the Export `<a href>` on `/payments`, so a change to the export route or `parseFilters` affects that page.
- `src/app/api/` has two route handlers today: `GET /api/payments` (JSON, paginated) and `GET /api/payments/export` (CSV, every matching row). Both start with `parseFilters`. The `/payments` page does not: it builds its own filter object, so keep its status, merchant, and search handling in step with `parseFilters`.
- `queryPayments` = `filterPayments` → `sortPayments` → `paginate`. The export composes `filterPayments` and `sortPayments` itself to skip `paginate`, so a step added to `queryPayments` must be added to the export route too.
- `store.ts` keeps the generated data on `globalThis`, so hot reload keeps your writes and only a restart resets them.

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.

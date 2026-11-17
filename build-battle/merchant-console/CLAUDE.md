# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Run it

```bash
npm install
npm run dev
```

No database, no seed step, no Docker.

## Commands

```bash
npm test                                              # vitest run, all src/**/*.test.ts
npx vitest run src/lib/csv.test.ts -t exportFilename  # one file, one test by name
npm run test:watch
npm run lint                                          # next lint (next/core-web-vitals)
npm run build
```

Tests run in plain Node with no DOM, so they cover `src/lib/` and `src/data/` logic, not components. `@/` resolves to `src/`.

## Data lives in memory

The seed is code, not JSON. `src/data/generate.ts` builds the whole dataset at boot from a fixed-seed PRNG (120 days anchored to 2026-08-13 UTC), so every machine gets identical records. `src/data/store.ts` runs it once and caches the result on `globalThis.__northwindStore`, so dev-server reloads keep it. Merchants are a hand-written array in `src/data/merchants.ts`.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, extend `generate.ts` or `merchants.ts`. Never edit seed data to make a failing case disappear.

## How a request flows

- Pages under `src/app/` are server components that import from `src/data/` directly. They do not fetch the API.
- The query builder is `src/data/queries.ts`: `parseFilters` → `filterPayments` → `sortPayments` → `paginate`, combined as `queryPayments`.
- The only route handlers are `GET /api/payments` (JSON, paginated) and `GET /api/payments/export` (CSV via `src/lib/csv.ts`, same builder, no `paginate`).

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
- Status transitions and masking are in `.claude/rules/cards.md`.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Console routes: overview, payments, disputes, payouts. Cards is NWP-201 and does not exist yet |
| `src/app/api/` | Route handlers |
| `src/data/` | Seed generator, the in-memory store, the query builder, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.

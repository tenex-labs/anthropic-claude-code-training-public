# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Run it

```bash
npm install
npm run dev                          # http://localhost:3000, redirects to /overview
npm test                             # Vitest, node env, no DOM, under a second
npx vitest run src/lib/csv.test.ts   # one test file
npx vitest run -t "exportFilename"  # tests whose name matches
npm run lint                         # next lint
npm run build                        # also type-checks
```

No database, no seed step, no Docker.

## Data lives in memory

Seed data is generated in code, not loaded from JSON: `src/data/generate.ts` uses a fixed-seed PRNG, so every machine gets identical records. `src/data/store.ts` builds the store once and pins it on `globalThis` so dev-server reloads do not reset it.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, extend the generator. Never edit seed data to make a failing case disappear.

## How a request reaches the data

- Pages under `src/app/` are async server components that import from `src/data/` directly. They do not call the API routes. Filters live in the URL, and client components such as `payments/filter-bar.tsx` only `router.push` new query strings.
- `src/data/queries.ts` is the query builder: `parseFilters` (the allowlist), `filterPayments`, `sortPayments`, `paginate`, and `queryPayments`, which combines all of them. `GET /api/payments` returns one page. `GET /api/payments/export` filters and sorts but skips `paginate`, so it covers every matching row.
- `src/lib/csv.ts` owns the export columns and serialization. Its tests in `csv.test.ts` are where new serializer tests go.

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
| `src/data/` | Seed generator, the in-memory store, query builder, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.

## Release Standards

- **Every change needs test evidence before it merges.** The pull request shows what was run (for example `npm test` output, or the steps used to check a UI change) and that it passed.
- **No direct commits to `main`.** Work on a ticket branch and merge through a pull request.
- **Every pull request includes a one-line business impact summary**, stating who benefits and how. For example: "Ops can drop card last-four from merchant exports, removing hours of manual cleanup each month."

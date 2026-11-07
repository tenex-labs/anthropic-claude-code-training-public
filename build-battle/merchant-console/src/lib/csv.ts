import { merchantById } from "@/data/merchants"
import { parseFilters } from "@/data/queries"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Everything the client sends
 * is checked here against an allowlist before it reaches the query builder or
 * the filename; route handlers call `parseExportRequest` rather than reading
 * params themselves. The card last four is off unless someone asks for it,
 * because these files go to merchants.
 *
 * Server-only: this module imports the query builder, and with it the store.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

export type ExportScope = "current" | "all"

/** What ships when the client does not say: every column except the last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  // A file with no columns is the empty export NWP-101 forbids. The route
  // rejects it first; this keeps the serializer honest if a caller does not.
  if (columns.length === 0) {
    throw new RangeError("toCsv needs at least one column")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * `columns` is a comma-separated allowlist. Missing means the defaults; present
 * but empty, unknown, or repeated is an error. Order is kept as requested.
 * No trimming or case folding: the dialog sends exact names.
 */
export function parseExportColumns(raw: string | null): Parsed<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }
  if (raw === "") return { ok: false, error: "Select at least one column." }

  const requested = raw.split(",")
  const seen = new Set<string>()
  for (const name of requested) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) {
      return { ok: false, error: `Unknown column: "${name}".` }
    }
    if (seen.has(name)) {
      return { ok: false, error: `Column listed twice: "${name}".` }
    }
    seen.add(name)
  }
  return { ok: true, value: requested as ExportColumn[] }
}

export function parseExportScope(raw: string | null): Parsed<ExportScope> {
  if (raw === null || raw === "current") return { ok: true, value: "current" }
  if (raw === "all") return { ok: true, value: "all" }
  return { ok: false, error: 'Scope must be "current" or "all".' }
}

/** Filters for a scope. "all" still goes through the allowlist, never a hand-built object. */
export function filtersForScope(
  scope: ExportScope,
  params: URLSearchParams,
): PaymentFilters {
  return parseFilters(scope === "all" ? new URLSearchParams() : params)
}

export type ExportRequest = {
  columns: ExportColumn[]
  scope: ExportScope
  filters: PaymentFilters
  filename: string
}

/** Everything the export route decides, kept pure so it is tested beside the serializer. */
export function parseExportRequest(
  params: URLSearchParams,
  date = new Date(),
): Parsed<ExportRequest> {
  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return columns
  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) return scope

  const filters = filtersForScope(scope.value, params)
  return {
    ok: true,
    value: {
      columns: columns.value,
      scope: scope.value,
      filters,
      filename: exportFilename(date, { scope: scope.value, filters }),
    },
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * `payments-<segments>-<UTC date>.csv`. Segments come only from allowlisted
 * values (status) or server data (merchant name looked up by id), never from
 * client text. Without options the name is the legacy `payments-<date>.csv`.
 */
export function exportFilename(
  date = new Date(),
  opts?: { scope: ExportScope; filters: PaymentFilters },
): string {
  const day = date.toISOString().slice(0, 10)
  if (!opts) return `payments-${day}.csv`

  const segments: string[] = []
  if (opts.scope === "current") {
    const { merchantId, status, search, from, to } = opts.filters
    const merchant = merchantId ? merchantById(merchantId) : undefined
    const merchantSlug = merchant ? slugify(merchant.name) : ""

    if (merchantSlug) segments.push(merchantSlug)
    if (status && status !== "all") segments.push(status)
    const narrowed =
      Boolean(search?.trim()) || Boolean(from) || Boolean(to) || (Boolean(merchantId) && !merchant)
    if (narrowed) segments.push("filtered")
  }
  if (segments.length === 0) segments.push("all")

  return `payments-${segments.join("-")}-${day}.csv`
}

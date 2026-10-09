import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so they are checked against the allowlists below before anything
 * reaches a query or a filename. Card last four is off unless asked for.
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

/** What ships when the client does not say. Last four stays out by default. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Parses the `columns` param: comma-separated, in the order the client wants.
 * Absent means the defaults. Unknown names and an empty selection are
 * rejected rather than silently dropped, so a typo never ships a file.
 */
export function parseExportColumns(
  raw: string | null,
): Parsed<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { ok: false, error: "Select at least one column to export." }
  }

  const unknown = requested.find(
    (name) => !EXPORT_COLUMNS.includes(name as ExportColumn),
  )
  if (unknown !== undefined) {
    return { ok: false, error: `Unknown export column: ${unknown}` }
  }

  return { ok: true, value: [...new Set(requested as ExportColumn[])] }
}

/** Parses the `scope` param. Absent means the current filter. */
export function parseExportScope(raw: string | null): Parsed<ExportScope> {
  if (raw === null) return { ok: true, value: "filter" }
  if (EXPORT_SCOPES.includes(raw as ExportScope)) {
    return { ok: true, value: raw as ExportScope }
  }
  return { ok: false, error: `Unknown export scope: ${raw}` }
}

/**
 * The filename label for an export. Built only from allowlisted values, so
 * free text from the client (a search term, an unknown merchant id) never
 * lands in a filename.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"

  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  if (filters.merchantId && merchantById(filters.merchantId)) {
    parts.push(filters.merchantId)
  }
  if (filters.search?.trim()) parts.push("search")
  return parts.length > 0 ? parts.join("-") : "all"
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
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export function exportFilename(date = new Date(), label?: string): string {
  const prefix = label ? `payments-${label}` : "payments"
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`
}

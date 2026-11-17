import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS here, on the server,
 * before they reach the serializer or the filename.
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

/**
 * What ships when nobody chooses. The card last four is off: most exports go
 * to a merchant, and that file must not carry card digits by accident.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ExportScope = "filter" | "all"

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Parse the `columns` query param: a comma-separated list, kept in the order
 * given, duplicates dropped. Absent means the defaults. Anything outside the
 * allowlist, or an empty selection, is rejected rather than ignored.
 */
export function parseExportColumns(raw: string | null): Parsed<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const unknown = requested.filter((name) => !isExportColumn(name))
  if (unknown.length > 0) {
    return { ok: false, error: "Unknown export column requested." }
  }

  return { ok: true, value: [...new Set(requested as ExportColumn[])] }
}

/** Parse the `scope` query param. Absent means the current filter. */
export function parseExportScope(raw: string | null): Parsed<ExportScope> {
  if (raw === null || raw === "filter") return { ok: true, value: "filter" }
  if (raw === "all") return { ok: true, value: "all" }
  return { ok: false, error: "Scope must be 'filter' or 'all'." }
}

/**
 * The scope part of the filename. Built only from values that are already
 * allowlisted: the status, and a merchant id that resolves to a real
 * merchant. Free-text search never reaches a filename.
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
  if (parts.length > 0) return parts.join("-")

  // Any other active filter (search, dates, an unrecognised merchant) still
  // narrows the rows, so the name must not claim "all".
  const narrowed =
    filters.search || filters.from || filters.to || filters.merchantId
  return narrowed ? "filtered" : "all"
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

/** `payments-2026-08-13.csv`, or `payments-disputed-2026-08-13.csv` with a label. UTC date. */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

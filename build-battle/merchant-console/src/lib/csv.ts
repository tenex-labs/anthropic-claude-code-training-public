import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { utcDayKey } from "./dates"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names and the scope
 * arrive from the client, so the route validates both here, against these
 * allowlists, before anything reaches the serializer or the filename.
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

/** What ships when nobody chooses: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

/**
 * Parse the `columns` parameter, a comma-separated list. Absent means the
 * defaults. Order is kept and duplicates are dropped. An empty list or any
 * name outside EXPORT_COLUMNS returns null, and the caller rejects it.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) return null
  if (!names.every((name) => EXPORT_COLUMNS.includes(name as ExportColumn))) {
    return null
  }
  return [...new Set(names as ExportColumn[])]
}

/** Parse the `scope` parameter. Absent means the current filter. */
export function parseExportScope(raw: string | null): ExportScope | null {
  if (raw === null) return "filtered"
  return EXPORT_SCOPES.includes(raw as ExportScope) ? (raw as ExportScope) : null
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

/**
 * `payments-2026-08-13.csv`, or `payments-disputed-2026-08-13.csv` with a
 * label. The label must come from an allowlisted value, never raw input.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = utcDayKey(date.toISOString())
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses which columns ship (NWP-101). Column names arrive from the
 * client, so they pass through `parseExportColumns` — an allowlist against
 * EXPORT_COLUMNS — before they reach the serializer or a filename.
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
 * What ships when the client names no columns. Card last four is left out so
 * a file bound for a merchant is safe without hand editing; ops opts in.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ParsedColumns =
  | { columns: ExportColumn[]; error?: undefined }
  | { columns?: undefined; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a comma-separated `columns` param. Absent means the defaults;
 * present but empty is an error, because an export with no columns is a
 * mistake, not a request. Keeps the order given and drops duplicates.
 */
export function parseExportColumns(raw: string | null): ParsedColumns {
  if (raw === null) return { columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { error: "Choose at least one column to export." }
  }

  // The message never echoes client input back.
  if (!requested.every(isExportColumn)) {
    return {
      error: `Unknown export column. Allowed: ${EXPORT_COLUMNS.join(", ")}.`,
    }
  }

  return { columns: [...new Set(requested as ExportColumn[])] }
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
  if (columns.length === 0) {
    throw new Error("toCsv needs at least one column")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `payments-<label>-YYYY-MM-DD.csv`, UTC date. The label must come from an
 * allowlisted value (a scope or a validated status), never raw client text.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). Column names arrive from the client, so
 * they are checked against EXPORT_COLUMNS here before they reach toCsv. The
 * card last four is off unless someone asks for it, because these files go
 * to merchants.
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

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Validates a comma-separated column list from the client. A missing param
 * means the defaults. An empty list or any unknown name is rejected with
 * null, not silently dropped, so a typo cannot ship a file missing a column.
 * Duplicates collapse, and the requested order is kept.
 */
export function parseColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) return null

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) return null
    if (!columns.includes(name as ExportColumn)) columns.push(name as ExportColumn)
  }
  return columns
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

/** The label must come from an allowlisted value, never raw client text. */
export function exportFilename(date = new Date(), label?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${stamp}.csv` : `payments-${stamp}.csv`
}

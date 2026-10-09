import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * The column set is fixed. Ops has asked for control over it — that is
 * NWP-101 — but today everyone gets every column, including the card
 * last four, whether or not the file is going to a merchant.
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

export const DEFAULT_EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "amount",
  "currency",
] as const satisfies readonly ExportColumn[]

const EXPORT_COLUMN_SET = new Set<string>(EXPORT_COLUMNS)

/** Parse and validate the client-supplied column list at the route boundary. */
export function parseExportColumns(value: string | null): ExportColumn[] {
  if (value === null) return [...DEFAULT_EXPORT_COLUMNS]

  const requested = value.split(",").map((column) => column.trim())
  if (requested.length === 0 || requested.some((column) => !column)) {
    throw new Error("At least one export column is required")
  }

  const invalid = requested.find((column) => !EXPORT_COLUMN_SET.has(column))
  if (invalid) throw new Error(`Unknown export column: ${invalid}`)

  if (new Set(requested).size !== requested.length) {
    throw new Error("Export columns must be unique")
  }

  return requested as ExportColumn[]
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
  columns: readonly ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
): string {
  if (columns.length === 0) {
    throw new Error("At least one export column is required")
  }

  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export function exportFilename(
  date = new Date(),
  label = "filtered",
): string {
  return `payments-${label}-${date.toISOString().slice(0, 10)}.csv`
}

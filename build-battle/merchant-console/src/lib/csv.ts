import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). The card last four is off unless asked
 * for, because most of these files end up with a merchant.
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

/** What an export contains when the caller does not say. Never the last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Column names arrive from the client, so they are checked against the
 * allowlist here before they reach the serializer or anything else.
 * Absent means the defaults; present but empty is an error, not an empty file.
 */
export function parseExportColumns(
  raw: string | null,
): { columns: ExportColumn[] } | { error: string } {
  if (raw === null) return { columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0) return { error: "Select at least one column." }

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!isExportColumn(name)) return { error: "Unknown export column." }
    if (!columns.includes(name)) columns.push(name)
  }
  return { columns }
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

/** `label` must come from an allowlist; it is written into a response header. */
export function exportFilename(date = new Date(), label?: string): string {
  const prefix = label ? `payments-${label}` : "payments"
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`
}

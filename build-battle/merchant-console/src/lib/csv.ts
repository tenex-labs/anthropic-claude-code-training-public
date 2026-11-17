import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). The card last four is opt-in: the
 * default set leaves it out, so a file bound for a merchant needs no cleanup.
 * Column names arrive from the client, so parseExportColumns checks them
 * against EXPORT_COLUMNS before they reach toCsv.
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

/** What the export dialog offers by default. The card last four is opt-in. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ParsedColumns =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

/**
 * Column names arrive from the client, so they are checked against
 * EXPORT_COLUMNS before they reach the serializer. A missing param means the
 * defaults; a present-but-empty one is an error, never an empty file.
 */
export function parseExportColumns(raw: string | null): ParsedColumns {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0) {
    return { ok: false, error: "Select at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!(EXPORT_COLUMNS as readonly string[]).includes(name)) {
      return { ok: false, error: "Unknown export column." }
    }
    if (!columns.includes(name as ExportColumn)) columns.push(name as ExportColumn)
  }
  return { ok: true, columns }
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
 * `scopeLabel` must come from an allowlist (a status, "all", "filtered"),
 * never from raw client input, because it ends up in a header.
 */
export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const day = date.toISOString().slice(0, 10)
  return scopeLabel ? `payments-${scopeLabel}-${day}.csv` : `payments-${day}.csv`
}

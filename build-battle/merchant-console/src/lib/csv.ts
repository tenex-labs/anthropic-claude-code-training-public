import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses which columns ship (NWP-101). The client sends column names,
 * so they are checked against EXPORT_COLUMNS by parseExportColumns before
 * anything is serialized. The card last four is opt-in: files often go to
 * merchants, and a default that leaks it is how the near-miss happened.
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

/** What an export contains when ops has not chosen: everything but last4. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ParsedExportColumns =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; message: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validates the `columns` query param against the allowlist.
 *
 * - absent (`null`): the defaults, which leave out last4
 * - a comma-separated list: kept in the order requested, duplicates dropped
 * - any unknown name, or nothing selected: rejected with a message safe to show
 */
export function parseExportColumns(raw: string | null): ParsedExportColumns {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }

  const unknown = requested.filter((name) => !isExportColumn(name))
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unknown export column: ${unknown.join(", ")}.`,
    }
  }

  return { ok: true, columns: [...new Set(requested as ExportColumn[])] }
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
 * `payments-<label>-<UTC date>.csv`, or `payments-<UTC date>.csv` without a
 * label. The label is chosen by the server from validated values (a status,
 * "all", "filtered"), never copied from the request.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * `EXPORT_COLUMNS` is the allowlist of everything that can be exported.
 * Callers choose a subset (NWP-101); the default leaves out the card last
 * four, so a file is safe to send to a merchant unless someone opts in.
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

/** What an export contains when the caller does not choose: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Validate a client-supplied, comma-separated column list against the allowlist.
 *
 * - `null` (parameter absent) returns the default set, which omits `last4`.
 * - A valid list comes back in the requested order, duplicates dropped.
 * - An empty selection returns `[]`; the caller decides that is an error.
 * - Any unknown name makes the whole list invalid and returns `null`.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "")

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) return null
    if (!columns.includes(name as ExportColumn)) {
      columns.push(name as ExportColumn)
    }
  }
  return columns
}

/**
 * `scope` is a label the caller has already checked against an allowlist
 * (a status, "all", "filtered"). Never pass raw client input here.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  return scope ? `payments-${scope}-${day}.csv` : `payments-${day}.csv`
}

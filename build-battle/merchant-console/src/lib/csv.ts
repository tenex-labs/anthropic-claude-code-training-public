import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the column set per export (NWP-101). The server validates the
 * requested columns against EXPORT_COLUMNS before anything reaches a query
 * or a filename; when no columns are requested, DEFAULT_EXPORT_COLUMNS
 * applies, which leaves the card last four out.
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

/** What ships when ops does not pick: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Validate a client-supplied comma list against the EXPORT_COLUMNS allowlist.
 * Absent (`null`) means the default set; an empty list or any unknown name
 * returns null and the caller rejects the request.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  if (names.length === 0) return null
  const valid = names.every((name) =>
    EXPORT_COLUMNS.includes(name as ExportColumn),
  )
  return valid ? (names as ExportColumn[]) : null
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Minor units to a plain decimal for the export: `25000` → `"250.00"`.
 * No symbol and no separators, so the column sums in a spreadsheet; the
 * currency travels in its own column. Integer math end to end.
 */
function amountCell(minorUnits: number): string {
  const sign = minorUnits < 0 ? "-" : ""
  const abs = Math.abs(minorUnits)
  const units = Math.trunc(abs / 100)
  const cents = String(abs % 100).padStart(2, "0")
  return `${sign}${units}.${cents}`
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
      return amountCell(payment.amount)
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
 * `payments-2026-08-13.csv`, or `payments-disputed-2026-08-13.csv` when the
 * caller passes a scope label. Labels come from values already validated
 * against an allowlist (a payment status, or "all") — never raw input.
 */
export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  const scope = scopeLabel ? `${scopeLabel}-` : ""
  return `payments-${scope}${stamp}.csv`
}

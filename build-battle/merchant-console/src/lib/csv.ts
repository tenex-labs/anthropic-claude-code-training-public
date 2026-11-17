import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS before use, and the
 * card last four is left out unless someone asks for it.
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

/** Every column except the card last four, which is opt-in. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["current", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a comma-separated column list from the client against the
 * allowlist. Unknown names are dropped, duplicates collapse to their first
 * position, and the requested order is kept. A missing parameter means the
 * defaults; a parameter that leaves nothing valid returns an empty list,
 * which the caller rejects rather than writing an empty file.
 */
export function parseColumns(raw: string | null | undefined): ExportColumn[] {
  if (raw == null) return [...DEFAULT_EXPORT_COLUMNS]
  const columns: ExportColumn[] = []
  for (const name of raw.split(",")) {
    const trimmed = name.trim()
    if (isExportColumn(trimmed) && !columns.includes(trimmed)) {
      columns.push(trimmed)
    }
  }
  return columns
}

export function parseScope(raw: string | null | undefined): ExportScope {
  return raw === "all" ? "all" : "current"
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
 * The scope part of the filename, built only from allowlisted values:
 * "all" when every payment is exported or no filter is active, the status
 * when one is set, otherwise "filtered".
 */
export function exportLabel(scope: ExportScope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const { merchantId, search, from, to } = filters
  return merchantId || search || from || to ? "filtered" : "all"
}

/**
 * `payments-<label>-<UTC date>.csv`. The label is "all" for every payment,
 * the status for a status filter, or "filtered" for any other filter. It is
 * only ever built from allowlisted values, never from raw client text.
 * With no label the name is `payments-<date>.csv`.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

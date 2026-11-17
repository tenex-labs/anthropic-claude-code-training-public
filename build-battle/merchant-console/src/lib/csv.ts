import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so the route runs them through parseExportColumns and
 * parseExportScope before anything is queried or written.
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
 * What ships when nobody chooses: every column except the card last four,
 * because these files go to merchants.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(name: string): name is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(name)
}

export type ParsedExportColumns =
  { ok: true; columns: ExportColumn[] } | { ok: false; error: string }

/**
 * Validates the `columns` query parameter, e.g. `id,amount,currency`.
 *
 * Every name is checked against EXPORT_COLUMNS and the requested order is
 * kept. A missing parameter means the default set. An empty list, an unknown
 * name, or a repeated name is rejected rather than guessed at.
 */
export function parseExportColumns(raw: string | null): ParsedExportColumns {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!isExportColumn(name)) {
      return {
        ok: false,
        error: `Unknown export column. Allowed: ${EXPORT_COLUMNS.join(", ")}.`,
      }
    }
    if (columns.includes(name)) {
      return { ok: false, error: "Each export column can appear only once." }
    }
    columns.push(name)
  }
  return { ok: true, columns }
}

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** `filter` (the default) exports the current filter; `all` ignores it. Anything else is null. */
export function parseExportScope(raw: string | null): ExportScope | null {
  if (raw === null) return "filter"
  return (EXPORT_SCOPES as readonly string[]).includes(raw)
    ? (raw as ExportScope)
    : null
}

export type ExportLabel = PaymentStatus | "filtered" | "all"

/**
 * Names what is in the file, for the filename. Built only from values that
 * parseFilters has already checked, never from free text like the search box.
 */
export function exportLabel(filters: PaymentFilters): ExportLabel {
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
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

/** `payments-disputed-2026-08-13.csv`. The date is the UTC day of the export. */
export function exportFilename(date = new Date(), label?: ExportLabel): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Everything that arrives
 * from the client is checked here against an allowlist before it reaches the
 * serializer or the download filename.
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
 * What ships when the request names no columns. The card last four is left
 * out on purpose: these files go to merchants, so it has to be opted into.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Parse the comma-separated `columns` parameter.
 *
 * Absent means the default set. Present but empty is rejected rather than
 * producing a file with no columns. Any name outside `EXPORT_COLUMNS` is
 * rejected outright, not silently dropped. Order is kept, and a repeated name
 * stays at its first position.
 */
export function parseExportColumns(raw: string | null): Parsed<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!(EXPORT_COLUMNS as readonly string[]).includes(name)) {
      return {
        ok: false,
        error: "The export asked for a column that does not exist.",
      }
    }
    if (!columns.includes(name as ExportColumn)) {
      columns.push(name as ExportColumn)
    }
  }
  return { ok: true, value: columns }
}

/** Parse the `scope` parameter. Absent means the current filter. */
export function parseExportScope(raw: string | null): Parsed<ExportScope> {
  if (raw === null) return { ok: true, value: "filtered" }
  if ((EXPORT_SCOPES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as ExportScope }
  }
  return {
    ok: false,
    error: "Export scope must be the current filter or all payments.",
  }
}

/**
 * The filters an export runs with. "All payments" clears every filter but
 * keeps the sort, so one query builder serves both scopes and the row count
 * shown on the page matches the file.
 */
export function filtersForScope(
  filters: PaymentFilters,
  scope: ExportScope,
): PaymentFilters {
  if (scope === "filtered") return filters
  return { status: "all", sort: filters.sort, direction: filters.direction }
}

/**
 * The scope part of the filename. Built only from validated values: the
 * scope itself, or a status that has already passed `parseFilters()`.
 */
export function exportLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  return "filtered"
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

/** `payments-<label>-<UTC date>.csv`, or `payments-<UTC date>.csv` with no label. */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

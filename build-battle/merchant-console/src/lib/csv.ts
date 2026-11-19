import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so the route checks them here against an allowlist before anything
 * is serialized or named.
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

/** Card last four is opt-in: files often go to merchants. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ParsedExportColumns =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; message: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Parse the `columns` query param: a comma list, kept in the order given,
 * duplicates dropped. Absent means the defaults. Present but empty, or naming
 * anything outside EXPORT_COLUMNS, is rejected rather than silently fixed.
 */
export function parseExportColumns(raw: string | null): ParsedExportColumns {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }
  if (!requested.every(isExportColumn)) {
    return {
      ok: false,
      message: `Unknown export column. Allowed: ${EXPORT_COLUMNS.join(", ")}.`,
    }
  }
  return { ok: true, columns: [...new Set(requested)] }
}

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** Absent means the current filter. Anything unrecognised is null. */
export function parseExportScope(raw: string | null): ExportScope | null {
  if (raw === null) return "filter"
  return (EXPORT_SCOPES as readonly string[]).includes(raw)
    ? (raw as ExportScope)
    : null
}

/**
 * The filename label. Built only from allowlisted values, never from merchant
 * ids or search text: `all`, the status, and `filtered` when other filters
 * narrowed the rows.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"
  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    parts.push("filtered")
  }
  return parts.length > 0 ? parts.join("-") : "all"
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

/** `payments-[label-]YYYY-MM-DD.csv`, UTC date. A label outside [a-z-] is dropped. */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label && /^[a-z]+(-[a-z]+)*$/.test(label)
    ? `payments-${label}-${day}.csv`
    : `payments-${day}.csv`
}

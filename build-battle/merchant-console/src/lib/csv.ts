import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS here before they
 * reach the serializer. The card last four is opt-in.
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

/** Every column except the card last four, which must be asked for. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isExportColumn(name: string): name is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(name)
}

/**
 * Validates the `columns` query param against the allowlist.
 *
 * - Missing param: the defaults (no last four).
 * - Present but empty: rejected, so a request never produces an empty file.
 * - Any unknown name: rejected, rather than silently dropped.
 * - Order is the client's; duplicates are dropped.
 */
export function parseExportColumns(
  param: string | null,
): ParseResult<ExportColumn[]> {
  if (param === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const names = param
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const unknown = names.filter((name) => !isExportColumn(name))
  if (unknown.length > 0) {
    return { ok: false, error: "Unknown export column requested." }
  }

  return { ok: true, value: [...new Set(names as ExportColumn[])] }
}

export const EXPORT_SCOPES = ["filter", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** Validates the `scope` query param. Missing means the current filter. */
export function parseExportScope(param: string | null): ParseResult<ExportScope> {
  if (param === null || param === "") return { ok: true, value: "filter" }
  if ((EXPORT_SCOPES as readonly string[]).includes(param)) {
    return { ok: true, value: param as ExportScope }
  }
  return { ok: false, error: "Scope must be 'filter' or 'all'." }
}

/**
 * The scope part of the filename, built only from validated values: a known
 * status and a merchant id that exists. Free text (search, dates) never
 * reaches the filename; it shows up as "filtered".
 */
export function exportScopeLabel(
  filters: PaymentFilters,
  scope: ExportScope,
): string {
  if (scope === "all") return "all"
  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  if (filters.merchantId && merchantById(filters.merchantId)) {
    parts.push(filters.merchantId)
  }
  if (filters.search || filters.from || filters.to) parts.push("filtered")
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

export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const day = date.toISOString().slice(0, 10)
  const safe = scopeLabel?.replace(/[^a-z0-9_-]/gi, "")
  return safe ? `payments-${safe}-${day}.csv` : `payments-${day}.csv`
}

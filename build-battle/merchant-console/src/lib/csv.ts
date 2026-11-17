import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so the parsers below check them against an allowlist before they
 * reach the serializer or the download filename.
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

/** What an export contains when nobody chose: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a comma-separated `columns` param. Missing means the default set;
 * present but empty is rejected, so an export always has at least one column.
 * Keeps the requested order and drops duplicates. The error never echoes the
 * client's text back.
 */
export function parseExportColumns(raw: string | null): ParseResult<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
  if (requested.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }
  if (!requested.every(isExportColumn)) {
    return {
      ok: false,
      error: `Unknown export column. Allowed columns: ${EXPORT_COLUMNS.join(", ")}.`,
    }
  }
  return { ok: true, value: [...new Set(requested)] }
}

/** Validate the `scope` param. Missing or empty means the current filter. */
export function parseExportScope(raw: string | null): ParseResult<ExportScope> {
  if (raw === null || raw === "") return { ok: true, value: "filtered" }
  const scope = EXPORT_SCOPES.find((allowed) => allowed === raw)
  if (!scope) {
    return { ok: false, error: `Unknown export scope. Use one of: ${EXPORT_SCOPES.join(", ")}.` }
  }
  return { ok: true, value: scope }
}

/**
 * The scope part of the filename, built only from validated values. A status
 * filter names the file; any other filter adds "filtered", so a narrowed
 * export is never named as if it held every payment with that status.
 */
export function exportScopeLabel(scope: ExportScope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  const status = filters.status && filters.status !== "all" ? filters.status : null
  const narrowed = Boolean(filters.merchantId || filters.search || filters.from || filters.to)
  if (status && narrowed) return `${status}-filtered`
  if (status) return status
  return narrowed ? "filtered" : "all"
}

/**
 * Spreadsheets run a cell as a formula when it starts with one of these.
 * The export goes to merchants, so such cells are prefixed with an
 * apostrophe and read as text (OWASP CSV injection guidance).
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

function escapeCell(raw: string): string {
  const value = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw
  if (/[",\n]/.test(value) || value !== raw) return `"${value.replace(/"/g, '""')}"`
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
  const safeLabel = label?.replace(/[^a-z0-9_-]/gi, "")
  return safeLabel ? `payments-${safeLabel}-${day}.csv` : `payments-${day}.csv`
}

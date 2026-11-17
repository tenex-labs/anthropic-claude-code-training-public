import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names and scope
 * arrive from the client, so they are checked here against an allowlist
 * before they reach the serializer or the filename.
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

/** Card last four is off unless ops asks for it: files often go to merchants. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

function isExportColumn(name: string): name is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(name)
}

/**
 * Validate a comma-separated `columns` param. Missing means the defaults;
 * an empty list or any unknown name is rejected rather than guessed at.
 * Order is kept as requested, duplicates are dropped.
 */
export function parseExportColumns(
  raw: string | null,
): ParseResult<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }
  if (!names.every(isExportColumn)) {
    return { ok: false, message: "One or more columns are not available for export." }
  }
  return { ok: true, value: [...new Set(names)] as ExportColumn[] }
}

export const EXPORT_SCOPES = ["filtered", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** Validate the `scope` param. Missing means the current filter. */
export function parseExportScope(raw: string | null): ParseResult<ExportScope> {
  if (raw === null) return { ok: true, value: "filtered" }
  if ((EXPORT_SCOPES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as ExportScope }
  }
  return { ok: false, message: "Scope must be the current filter or all payments." }
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
 * `label` must come from an allowlisted value (a scope or a validated
 * status), never straight from the request.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

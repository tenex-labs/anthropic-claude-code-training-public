import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS here before anything
 * is written. Card last four is off unless someone asks for it, because these
 * files often go straight to a merchant.
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

/** What an export contains when the request names no columns. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["current", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a comma-separated `columns` parameter against the allowlist.
 * Missing means the defaults; present but empty, or any unknown name, is an
 * error. Order is kept as requested and repeats are dropped.
 */
export function parseExportColumns(
  raw: string | null | undefined,
): Parsed<ExportColumn[]> {
  if (raw === null || raw === undefined) {
    return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }
  }

  const names = raw
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

/** Validate the `scope` parameter. Missing means the current filter. */
export function parseExportScope(
  raw: string | null | undefined,
): Parsed<ExportScope> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: "current" }
  }
  if ((EXPORT_SCOPES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as ExportScope }
  }
  return { ok: false, error: "Scope must be current or all." }
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
  if (columns.length === 0) {
    throw new Error("toCsv needs at least one column")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `payments-2026-08-13.csv`, or with a label `payments-disputed-2026-08-13.csv`.
 * The label must come from an allowlist (a scope or a status), never raw input.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

/**
 * The filename label for an export: `all` for every payment, the status when
 * the current filter is a single status, and `filtered` otherwise.
 */
export function exportLabel(
  scope: ExportScope,
  filters: { status?: string; merchantId?: string; search?: string; from?: string; to?: string },
): string {
  if (scope === "all") return "all"
  const { status, merchantId, search, from, to } = filters
  const narrowed = Boolean(merchantId || search || from || to)
  if (status && status !== "all" && !narrowed) return status
  if (!narrowed && (!status || status === "all")) return "all"
  return "filtered"
}

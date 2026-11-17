import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so they are checked against the allowlists below before anything
 * reaches the query builder, the serializer, or the filename.
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

/** Human labels for the export dialog. */
export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * What ships when nobody chooses. Card last four is off: most exports go to
 * a merchant, and the default must be the safe file.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ExportOptions =
  | { ok: true; columns: ExportColumn[]; scope: ExportScope }
  | { ok: false; message: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validates `scope` and `columns` from the query string. Columns are
 * comma-separated, kept in the order requested, de-duplicated. A missing
 * `columns` means the defaults; a present but empty one is an error, because
 * a file with no columns is not an export.
 */
export function parseExportOptions(params: URLSearchParams): ExportOptions {
  const rawScope = params.get("scope")
  if (rawScope !== null && !(EXPORT_SCOPES as readonly string[]).includes(rawScope)) {
    return { ok: false, message: `Unknown export scope "${rawScope}". Use "filtered" or "all".` }
  }
  const scope = (rawScope ?? "filtered") as ExportScope

  const rawColumns = params.get("columns")
  if (rawColumns === null) {
    return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS], scope }
  }

  const requested = rawColumns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
  if (requested.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }

  const unknown = requested.find((column) => !isExportColumn(column))
  if (unknown !== undefined) {
    return { ok: false, message: `Unknown export column "${unknown}".` }
  }

  const columns = [...new Set(requested)] as ExportColumn[]
  return { ok: true, columns, scope }
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
    throw new RangeError("toCsv needs at least one column")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * Names the file after what is in it. Built only from allowlisted values
 * (scope, status, a merchant id the store knows), never free text, because
 * it ends up in a response header.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"

  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  if (filters.merchantId && merchantById(filters.merchantId)) {
    parts.push(filters.merchantId.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
  }
  if (filters.search?.trim()) parts.push("search")

  return parts.length > 0 ? parts.join("-") : "filtered"
}

export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

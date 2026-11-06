import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so the route handler runs them through the parsers below, which
 * check them against allowlists before anything reaches the store or the
 * filename.
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
 * What a file contains unless ops asks for more. The card last four is left
 * out, because these files go to merchants and it has to be opted into.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: string }

function isExportColumn(name: string): name is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(name)
}

/**
 * Parses the `columns` parameter: a comma-separated list of column names.
 *
 * No parameter at all means the defaults. Every name must be in
 * EXPORT_COLUMNS; the requested order is kept and repeats are dropped. An
 * empty list is rejected rather than producing a file with no columns.
 */
export function parseExportColumns(
  raw: string | null,
): ParseResult<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  if (names.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!isExportColumn(name)) {
      return {
        ok: false,
        error: `Unknown export column. Choose from: ${EXPORT_COLUMNS.join(", ")}.`,
      }
    }
    if (!columns.includes(name)) columns.push(name)
  }
  return { ok: true, value: columns }
}

/** Parses the `scope` parameter. No parameter means the current filter. */
export function parseExportScope(raw: string | null): ParseResult<ExportScope> {
  if (raw === null) return { ok: true, value: "filtered" }
  const scope = EXPORT_SCOPES.find((allowed) => allowed === raw)
  if (!scope) {
    return { ok: false, error: 'Export scope must be "filtered" or "all".' }
  }
  return { ok: true, value: scope }
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
 * The scope part of an export filename, built only from allowlisted values:
 * the status, and the merchant id when that merchant exists. A search or a
 * date range shows up as "filtered", never as the text the client sent.
 */
export function exportLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"

  const { status, merchantId, search, from, to } = filters
  const knownMerchant = merchantId ? merchantById(merchantId) : undefined
  const parts: string[] = []

  if (status && status !== "all") parts.push(status)
  if (knownMerchant) parts.push(knownMerchant.id)
  if (search?.trim() || from || to || (merchantId && !knownMerchant)) {
    parts.push("filtered")
  }
  return parts.length > 0 ? parts.join("-") : "all"
}

/** `payments-<label>-<UTC date>.csv`, or `payments-<UTC date>.csv` without a label. */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

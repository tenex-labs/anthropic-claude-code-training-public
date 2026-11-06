import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS here before they
 * reach the serializer or a filename. Card last four is off unless asked for.
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

/** What a file gets when ops does not choose: everything but the card digits. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

export function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

export type ParsedColumns =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; message: string }

/**
 * Validates a comma-separated column list from the client.
 *
 * Missing → the defaults. Present → every name must be on the allowlist,
 * duplicates collapse, the requested order is kept. An empty selection is
 * rejected rather than producing a file with no columns.
 */
export function parseColumns(raw: string | null): ParsedColumns {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }

  const unknown = requested.filter((name) => !isExportColumn(name))
  if (unknown.length > 0) {
    return { ok: false, message: `Unknown export column: ${unknown.join(", ")}.` }
  }

  return { ok: true, columns: [...new Set(requested as ExportColumn[])] }
}

export function parseScope(raw: string | null): ExportScope | null {
  if (raw === null) return "filtered"
  return (EXPORT_SCOPES as readonly string[]).includes(raw)
    ? (raw as ExportScope)
    : null
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
 * `payments-<scope>-<UTC date>.csv`, e.g. `payments-disputed-2026-08-13.csv`.
 *
 * `scope` is a list of already-validated labels (a status from the allowlist,
 * a known merchant id). Anything else is slugged defensively anyway, because
 * this string lands in a response header. No labels → just the date.
 */
export function exportFilename(date = new Date(), scope: string[] = []): string {
  const label = scope
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-")
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

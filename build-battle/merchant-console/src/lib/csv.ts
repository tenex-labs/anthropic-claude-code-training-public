import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * The client chooses columns and scope (NWP-101); this module owns the
 * allowlist they are checked against. Card last four is off unless asked for.
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
 * What ships when the client does not say: everything except the card last
 * four. Anything going to a merchant should not carry card data by accident.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string }

/**
 * Column names arrive from the client as `columns=id,amount`. Each one is
 * checked against `EXPORT_COLUMNS`; the requested order is kept and
 * duplicates are dropped. An absent param means the defaults; a present but
 * empty one is an error, never an empty file.
 */
export function parseExportColumns(raw: string | null): Parsed<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) {
    return { ok: false, message: "Select at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) {
      return { ok: false, message: `Unknown export column: ${name}` }
    }
    if (!columns.includes(name as ExportColumn)) columns.push(name as ExportColumn)
  }
  return { ok: true, value: columns }
}

export const EXPORT_SCOPES = ["filtered", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

export function parseExportScope(raw: string | null): Parsed<ExportScope> {
  if (raw === null) return { ok: true, value: "filtered" }
  if (EXPORT_SCOPES.includes(raw as ExportScope)) {
    return { ok: true, value: raw as ExportScope }
  }
  return { ok: false, message: `Unknown export scope: ${raw}` }
}

/**
 * The filename part that says what the file holds. Built only from
 * allowlisted values (scope and the validated status), never from search text
 * or ids, so nothing from the client is written into a header verbatim.
 */
export function exportLabel(scope: ExportScope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

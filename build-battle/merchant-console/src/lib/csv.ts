import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names and scope
 * arrive from the client, so they are checked against the allowlists below
 * before they reach the serializer or a filename. The card last four is off
 * unless someone asks for it, because these files go to merchants.
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

/** Every column except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function isExportColumn(name: string): name is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(name)
}

/**
 * Parses the `columns` query param: a comma-separated list of column names.
 * Absent means the defaults. Every name must be on the allowlist; the order
 * given is the order written, and duplicates are dropped.
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
    if (!isExportColumn(name)) {
      return { ok: false, error: "One or more requested columns are not available." }
    }
    if (!columns.includes(name)) columns.push(name)
  }
  return { ok: true, value: columns }
}

/** Parses the `scope` query param. Absent means the current filter. */
export function parseExportScope(raw: string | null): Parsed<ExportScope> {
  if (raw === null) return { ok: true, value: "filter" }
  if ((EXPORT_SCOPES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as ExportScope }
  }
  return { ok: false, error: "Export scope must be the current filter or all payments." }
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
 * `payments-YYYY-MM-DD.csv`, or `payments-{label}-YYYY-MM-DD.csv` with a
 * scope label. The date is UTC. Callers build the label from allowlisted
 * values only — never from free text such as a search term.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

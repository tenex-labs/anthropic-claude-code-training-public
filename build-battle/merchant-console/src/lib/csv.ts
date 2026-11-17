import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so the route runs them through the parsers below, which accept
 * only allowlisted values. Card last four is off unless asked for.
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

/** Every column except card last four, which has to be opted into. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

const isExportColumn = (value: string): value is ExportColumn =>
  (EXPORT_COLUMNS as readonly string[]).includes(value)

/**
 * Parses the `columns` query param against the allowlist.
 *
 * - Param absent: the default columns.
 * - Otherwise: the requested columns in the requested order, duplicates
 *   dropped. Any unknown name, or no columns at all, returns null so the
 *   route can reject the request instead of writing an empty file.
 * - An amount never ships without its currency: if `amount` is requested
 *   without `currency`, `currency` is added right after it.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0 || !requested.every(isExportColumn)) return null

  return withCurrency([...new Set(requested)])
}

/** Adds `currency` right after `amount` when it is missing. */
export function withCurrency(columns: ExportColumn[]): ExportColumn[] {
  const amountAt = columns.indexOf("amount")
  if (amountAt === -1 || columns.includes("currency")) return columns
  return [
    ...columns.slice(0, amountAt + 1),
    "currency",
    ...columns.slice(amountAt + 1),
  ]
}

export const EXPORT_SCOPES = ["current", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** Parses the `scope` query param. Absent means the current filter; anything unknown is null. */
export function parseExportScope(raw: string | null): ExportScope | null {
  if (raw === null) return "current"
  return (EXPORT_SCOPES as readonly string[]).includes(raw)
    ? (raw as ExportScope)
    : null
}

/** What the filename says about the rows in it. Built only from validated values. */
export type ExportLabel = "all" | "filtered" | PaymentStatus

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

/** `payments-disputed-2026-08-13.csv`, stamped with the UTC date. */
export function exportFilename(date = new Date(), label?: ExportLabel): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}

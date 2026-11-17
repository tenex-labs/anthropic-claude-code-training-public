import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  type ExportColumn,
} from "./exportColumns"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns. The column list itself lives in `exportColumns.ts`
 * so the export panel can share it; it is re-exported here so everything the
 * export needs can still be imported from one place.
 */

export { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, type ExportColumn }

export type ColumnSelection =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

/**
 * Turns the `columns` query value into a validated column list.
 *
 * Column names come from the client, so each one is checked against
 * EXPORT_COLUMNS. Nothing else ever reaches `toCsv`. An absent value means
 * "the defaults"; a present but empty value is an empty selection and is
 * rejected rather than producing an empty file.
 */
export function parseColumns(param: string | null | undefined): ColumnSelection {
  if (param === null || param === undefined) {
    return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }
  }
  if (param.trim() === "") {
    return { ok: false, error: "Select at least one column." }
  }

  // A stray or doubled comma is not a column name, so it is ignored.
  const requested = param
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "")
  if (requested.length === 0) {
    return { ok: false, error: "Select at least one column." }
  }
  const unknown = requested.filter(
    (name) => !(EXPORT_COLUMNS as readonly string[]).includes(name),
  )
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown column: ${unknown.join(", ")}.` }
  }

  // Keep the order the caller asked for, and drop repeats.
  return {
    ok: true,
    columns: [...new Set(requested)] as ExportColumn[],
  }
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
  columns: readonly ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export type ExportScope = "filter" | "all"

/**
 * Names what an export covers, for the filename: the status when one is
 * filtered on, `filtered` when other filters narrow it, otherwise `all`.
 * Every value returned is a fixed word or an allowlisted status.
 */
export function exportLabel(
  scope: ExportScope,
  filters: Pick<
    PaymentFilters,
    "status" | "merchantId" | "search" | "from" | "to"
  >,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const narrowed = Boolean(
    filters.merchantId || filters.search || filters.from || filters.to,
  )
  return narrowed ? "filtered" : "all"
}

/**
 * `payments-2026-08-13.csv`, or `payments-disputed-2026-08-13.csv` when a
 * label says what the scope was. The label is reduced to lowercase letters,
 * digits and underscores, so it can never alter the header it ends up in.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  const safe = label?.toLowerCase().replace(/[^a-z0-9_]/g, "")
  return safe ? `payments-${safe}-${day}.csv` : `payments-${day}.csv`
}

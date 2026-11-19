import { merchantById } from "./merchants"
import { store } from "./store"
import { Payment, PaymentFilters, PaymentStatus } from "./types"

const STATUSES: readonly (PaymentStatus | "all")[] = [
  "all",
  "authorized",
  "captured",
  "refunded",
  "failed",
  "disputed",
]

export const MAX_SEARCH_LENGTH = 200

/** `YYYY-MM-DD`, or a full timestamp that ends in `Z`. Nothing local. */
const UTC_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z)?$/

/** A UTC date as a normalized ISO timestamp, or null if it is not one. */
function parseUtcDate(raw: string): string | null {
  if (!UTC_DATE.test(raw)) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  // Reject dates that roll over rather than exist, like 2026-02-31.
  if (date.toISOString().slice(0, 10) !== raw.slice(0, 10)) return null
  return date.toISOString()
}

/**
 * The filter params with no fixed fallback: an unknown merchant or a bad date
 * cannot be quietly dropped, because dropping it widens the result. Route
 * handlers call this before `parseFilters` and return 400 with the message.
 */
export function validateFilterParams(params: URLSearchParams): string | null {
  const merchantId = params.get("merchantId")
  if (merchantId && !merchantById(merchantId)) return "Unknown merchant."

  const search = params.get("search")
  if (search && search.length > MAX_SEARCH_LENGTH) {
    return `Search must be ${MAX_SEARCH_LENGTH} characters or fewer.`
  }

  const from = params.get("from")
  const to = params.get("to")
  for (const [name, value] of [
    ["from", from],
    ["to", to],
  ] as const) {
    if (value && !parseUtcDate(value)) {
      return `"${name}" must be a UTC date (YYYY-MM-DD) or a timestamp ending in Z.`
    }
  }
  if (from && to && parseUtcDate(from)! > parseUtcDate(to)!) {
    return '"from" must be on or before "to".'
  }

  return null
}

/**
 * Anything from the client is checked against an allowlist before it reaches
 * a query. Route handlers call `validateFilterParams` first, then this, rather
 * than reading params themselves.
 */
export function parseFilters(params: URLSearchParams): PaymentFilters {
  const status = params.get("status")
  const sort = params.get("sort")
  const direction = params.get("direction")
  const page = Number(params.get("page") ?? "1")
  const merchantId = params.get("merchantId")
  const from = params.get("from")
  const to = params.get("to")

  return {
    status: STATUSES.includes(status as PaymentStatus)
      ? (status as PaymentStatus)
      : "all",
    merchantId: merchantId && merchantById(merchantId) ? merchantId : undefined,
    search: params.get("search") ?? undefined,
    from: (from && parseUtcDate(from)) || undefined,
    to: (to && parseUtcDate(to)) || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    sort: sort === "amount" ? "amount" : "createdAt",
    direction: direction === "asc" ? "asc" : "desc",
  }
}

/**
 * The one payment query builder. Every list, export, and metric goes through
 * it. A second implementation is a defect, not a shortcut.
 */

export const PAGE_SIZE = 20

export function filterPayments(filters: PaymentFilters): Payment[] {
  const { status, merchantId, search, from, to } = filters
  const needle = search?.trim().toLowerCase()

  return store.payments.filter((payment) => {
    if (status && status !== "all" && payment.status !== status) return false
    if (merchantId && payment.merchantId !== merchantId) return false
    if (from && payment.createdAt < from) return false
    if (to && payment.createdAt > to) return false

    if (needle) {
      const merchant = merchantById(payment.merchantId)
      const haystack = [
        payment.id,
        payment.description,
        payment.last4 ?? "",
        merchant?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    return true
  })
}

export function sortPayments(
  payments: Payment[],
  sort: PaymentFilters["sort"] = "createdAt",
  direction: PaymentFilters["direction"] = "desc",
): Payment[] {
  const factor = direction === "asc" ? 1 : -1
  return [...payments].sort((a, b) => {
    if (sort === "amount") {
      // Sort by the formatted amount so the order matches what the table shows.
      return String(a.amount).localeCompare(String(b.amount)) * factor
    }
    return a.createdAt.localeCompare(b.createdAt) * factor
  })
}

export function paginate<T>(rows: T[], page = 1, pageSize = PAGE_SIZE) {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: current,
    pageCount,
    pageSize,
  }
}

/** Filter, sort, and paginate in one call. Use this rather than composing by hand. */
export function queryPayments(filters: PaymentFilters) {
  const filtered = filterPayments(filters)
  const sorted = sortPayments(filtered, filters.sort, filters.direction)
  return paginate(sorted, filters.page, filters.pageSize)
}

export function paymentById(id: string) {
  return store.payments.find((p) => p.id === id) ?? null
}

export function refundsForPayment(paymentId: string) {
  return store.refunds.filter((r) => r.paymentId === paymentId)
}

export function disputeForPayment(paymentId: string) {
  return store.disputes.find((d) => d.paymentId === paymentId) ?? null
}

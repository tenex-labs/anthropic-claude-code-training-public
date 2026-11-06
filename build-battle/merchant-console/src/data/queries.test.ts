import { describe, expect, it } from "vitest"
import { filterPayments, sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * The query builder sits behind the payments table, its row counts, and the
 * CSV export, so a wrong comparison here shows up in all three at once.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("sortPayments by amount", () => {
  const payments = [994, 100000, 9873, 25000].map((amount, i) => ({
    ...payment,
    id: `pay_000${i}`,
    amount,
  }))

  it("compares minor units as numbers, not as text", () => {
    const desc = sortPayments(payments, "amount", "desc")
    expect(desc.map((p) => p.amount)).toEqual([100000, 25000, 9873, 994])

    const asc = sortPayments(payments, "amount", "asc")
    expect(asc.map((p) => p.amount)).toEqual([994, 9873, 25000, 100000])
  })
})

describe("filterPayments date range", () => {
  it("treats a date-only end date as the whole UTC day", () => {
    const sameDay = filterPayments({ from: "2026-08-12", to: "2026-08-12" })
    const expected = filterPayments({}).filter((p) =>
      p.createdAt.startsWith("2026-08-12"),
    )

    expect(expected.length).toBeGreaterThan(0)
    expect(sameDay).toEqual(expected)
  })

  it("still treats a full timestamp as an exact instant", () => {
    const cutoff = "2026-08-12T12:00:00.000Z"
    const rows = filterPayments({ to: cutoff })

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((p) => p.createdAt <= cutoff)).toBe(true)
    expect(rows).toEqual(
      filterPayments({}).filter((p) => p.createdAt <= cutoff),
    )
  })
})

import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { store } from "./store"
import { Payment } from "./types"

/**
 * Amounts are integer minor units, so sorting by amount is numeric. These
 * cases pick values whose text order disagrees with their numeric order —
 * "994" sorts above "9873" and "9999" above "10004" as strings — which is
 * exactly what the old comparator got wrong.
 */

const base: Payment = {
  id: "pay_0000",
  merchantId: "mch_01",
  amount: 0,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order",
}

const withAmounts = (...amounts: number[]): Payment[] =>
  amounts.map((amount, i) => ({ ...base, id: `pay_${i}`, amount }))

const amountsOf = (rows: Payment[]) => rows.map((p) => p.amount)

describe("sortPayments by amount", () => {
  it("puts the largest amount first when descending, not the longest-looking string", () => {
    const rows = withAmounts(994, 10004, 9873, 25000, 9999)
    expect(amountsOf(sortPayments(rows, "amount", "desc"))).toEqual([
      25000, 10004, 9999, 9873, 994,
    ])
  })

  it("puts the smallest amount first when ascending", () => {
    const rows = withAmounts(1000, 10004, 994, 9)
    expect(amountsOf(sortPayments(rows, "amount", "asc"))).toEqual([
      9, 994, 1000, 10004,
    ])
  })

  it("orders the seeded store numerically end to end", () => {
    const sorted = amountsOf(sortPayments(store.payments, "amount", "desc"))
    const numeric = [...sorted].sort((a, b) => b - a)
    expect(sorted).toEqual(numeric)
  })

  it("does not mutate its input", () => {
    const rows = withAmounts(3, 1, 2)
    sortPayments(rows, "amount", "asc")
    expect(amountsOf(rows)).toEqual([3, 1, 2])
  })
})

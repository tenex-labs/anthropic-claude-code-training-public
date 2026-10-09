import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Amounts are integer minor units, so sorting by amount must compare numbers.
 * Compared as text, "9999" outranks "48000" and "994" lands next to "9992",
 * which is what the payments list and the export used to do.
 */

const payment = (id: string, amount: number, createdAt: string): Payment => ({
  id,
  merchantId: "mch_01",
  amount,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt,
  description: "Order",
})

// Amounts chosen so text order and numeric order disagree: different digit
// counts, and a shared "99" prefix.
const payments = [
  payment("pay_a", 9999, "2026-08-01T10:00:00.000Z"),
  payment("pay_b", 48000, "2026-08-02T10:00:00.000Z"),
  payment("pay_c", 994, "2026-08-03T10:00:00.000Z"),
  payment("pay_d", 100000, "2026-08-04T10:00:00.000Z"),
  payment("pay_e", 5, "2026-08-05T10:00:00.000Z"),
]

const amounts = (rows: Payment[]) => rows.map((p) => p.amount)

describe("sortPayments by amount", () => {
  it("puts the largest amounts first when descending", () => {
    expect(amounts(sortPayments(payments, "amount", "desc"))).toEqual([
      100000, 48000, 9999, 994, 5,
    ])
  })

  it("puts the smallest amounts first when ascending", () => {
    expect(amounts(sortPayments(payments, "amount", "asc"))).toEqual([
      5, 994, 9999, 48000, 100000,
    ])
  })

  it("does not reorder the caller's array", () => {
    const before = payments.map((p) => p.id)
    sortPayments(payments, "amount", "desc")
    expect(payments.map((p) => p.id)).toEqual(before)
  })
})

describe("sortPayments by date", () => {
  it("still orders by createdAt, newest first by default", () => {
    expect(sortPayments(payments).map((p) => p.id)).toEqual([
      "pay_e",
      "pay_d",
      "pay_c",
      "pay_b",
      "pay_a",
    ])
  })
})

import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
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

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so they do not split", () => {
    const comma = { ...payment, description: "Order 1180, expedited" }
    expect(toCsv([comma], ["description"])).toBe(
      ["description", '"Order 1180, expedited"'].join("\n"),
    )
  })

  it("writes amounts as plain decimals from minor units, summable in a spreadsheet", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount", "currency"])).toBe(
      ["amount,currency", "1234567.89,USD"].join("\n"),
    )
    const cents = { ...payment, amount: 7 }
    expect(toCsv([cents], ["amount"])).toBe(["amount", "0.07"].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("parseExportColumns", () => {
  it("returns the default set when no columns are requested, with last4 left out", () => {
    expect(parseExportColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)
  })

  it("keeps the requested order, including last4 when asked for explicitly", () => {
    expect(parseExportColumns("amount,id,last4")).toEqual([
      "amount",
      "id",
      "last4",
    ])
  })

  it("rejects any name outside the allowlist rather than dropping it", () => {
    expect(parseExportColumns("id,amount;DROP TABLE payments")).toBeNull()
    expect(parseExportColumns("id,last_four")).toBeNull()
  })

  it("rejects an empty selection", () => {
    expect(parseExportColumns("")).toBeNull()
    expect(parseExportColumns(" , ,")).toBeNull()
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("puts a validated scope label between the prefix and the date", () => {
    expect(
      exportFilename(new Date("2026-08-13T10:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename(new Date("2026-08-13T10:00:00.000Z"), "all")).toBe(
      "payments-all-2026-08-13.csv",
    )
  })
})

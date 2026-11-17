import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
  parseColumns,
  parseScope,
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
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
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

describe("column selection (NWP-101)", () => {
  it("writes a subset of columns in the requested order, not the canonical one", () => {
    const columns = parseColumns("currency,amount,id")
    expect(columns).toEqual(["currency", "amount", "id"])
    expect(toCsv([payment], columns)).toBe(
      ["currency,amount,id", "USD,$250.00,pay_0001"].join("\n"),
    )
  })

  it("leaves the card last four out by default", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(parseColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
    const csv = toCsv([payment], parseColumns(undefined))
    expect(csv.split("\n")[0].split(",")).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("includes the last four only when asked for by name", () => {
    expect(toCsv([payment], parseColumns("id,last4"))).toBe(
      ["id,last4", "pay_0001,4242"].join("\n"),
    )
  })

  it("returns no columns for an empty selection, so the route can refuse it", () => {
    expect(parseColumns("")).toEqual([])
    expect(parseColumns(",,")).toEqual([])
  })

  it("drops names that are not on the allowlist and collapses duplicates", () => {
    expect(parseColumns("id,card_number,amount,id")).toEqual(["id", "amount"])
    expect(parseColumns("'; DROP TABLE payments;--")).toEqual([])
    expect(parseColumns("__proto__,constructor")).toEqual([])
  })
})

describe("export scope", () => {
  it("only accepts 'all', defaulting everything else to the current filter", () => {
    expect(parseScope("all")).toBe("all")
    expect(parseScope("current")).toBe("current")
    expect(parseScope(null)).toBe("current")
    expect(parseScope("everything")).toBe("current")
  })

  it("labels the file by scope, using only allowlisted values", () => {
    expect(exportLabel("all", { status: "disputed" })).toBe("all")
    expect(exportLabel("current", { status: "disputed" })).toBe("disputed")
    expect(exportLabel("current", { status: "all", merchantId: "mch_01" })).toBe(
      "filtered",
    )
    expect(exportLabel("current", { status: "all" })).toBe("all")
  })
})

describe("exportFilename", () => {
  it("puts the scope before the date", () => {
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })

  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })
})

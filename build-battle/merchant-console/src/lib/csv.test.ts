import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  parseExportScope,
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

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope before the date", () => {
    const day = new Date("2026-08-13T23:30:00.000Z")
    expect(exportFilename(day, "disputed")).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename(day, "all")).toBe("payments-all-2026-08-13.csv")
  })
})

describe("column selection (NWP-101)", () => {
  it("serializes a requested subset in the requested order", () => {
    const columns = parseExportColumns("status,id,created_at")
    expect(columns).toEqual(["status", "id", "created_at"])
    expect(toCsv([payment], columns!)).toBe(
      ["status,id,created_at", "captured,pay_0001,2026-03-14T10:15:00.000Z"].join("\n"),
    )
  })

  it("never ships an amount without its currency", () => {
    const columns = parseExportColumns("id,amount,status")
    expect(columns).toEqual(["id", "amount", "currency", "status"])
    expect(toCsv([payment], columns!)).toBe(
      ["id,amount,currency,status", "pay_0001,$250.00,USD,captured"].join("\n"),
    )
  })

  it("keeps the requested position of currency when both are asked for", () => {
    expect(parseExportColumns("currency,id,amount")).toEqual([
      "currency",
      "id",
      "amount",
    ])
  })

  it("drops a repeated column rather than writing it twice", () => {
    expect(parseExportColumns("id,status,id")).toEqual(["id", "status"])
  })

  it("leaves card last four out by default", () => {
    const columns = parseExportColumns(null)!
    expect(columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(columns).not.toContain("last4")

    const [header, row] = toCsv([payment], columns).split("\n")
    expect(header.split(",")).not.toContain("last4")
    expect(row).not.toContain("4242")
  })

  it("includes last four only when asked for", () => {
    expect(toCsv([payment], parseExportColumns("id,last4")!)).toBe(
      ["id,last4", "pay_0001,4242"].join("\n"),
    )
  })

  it("rejects an empty selection instead of producing an empty file", () => {
    expect(parseExportColumns("")).toBeNull()
    expect(parseExportColumns(" , ,")).toBeNull()
  })

  it("rejects a column that is not on the allowlist", () => {
    expect(parseExportColumns("id,amount;drop table payments")).toBeNull()
    expect(parseExportColumns("id,password")).toBeNull()
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter and accepts only known scopes", () => {
    expect(parseExportScope(null)).toBe("current")
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("everything")).toBeNull()
  })
})

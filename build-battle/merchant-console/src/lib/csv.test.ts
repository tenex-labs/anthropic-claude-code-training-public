import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
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

describe("parseExportColumns (NWP-101 column selection)", () => {
  /** Unwraps a successful parse, failing the test with the message otherwise. */
  function columnsOf(raw: string | null): ExportColumn[] {
    const parsed = parseExportColumns(raw)
    if (!parsed.ok) throw new Error(`expected columns, got: ${parsed.message}`)
    return parsed.columns
  }

  it("keeps a subset of columns in the order requested, not the table order", () => {
    const columns = columnsOf("amount,id,status")
    expect(columns).toEqual(["amount", "id", "status"])
    expect(toCsv([payment], columns)).toBe(
      ["amount,id,status", "$250.00,pay_0001,captured"].join("\n"),
    )
  })

  it("excludes the card last four by default", () => {
    const columns = columnsOf(null)
    expect(columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(columns).not.toContain("last4")

    const [header, row] = toCsv([payment], columns).split("\n")
    expect(header.split(",")).not.toContain("last4")
    expect(row).not.toContain(payment.last4)
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    for (const raw of ["", " ", ",,"]) {
      expect(parseExportColumns(raw)).toEqual({
        ok: false,
        message: "Choose at least one column to export.",
      })
    }
  })

  it("rejects a column that is not on the allowlist", () => {
    const parsed = parseExportColumns("id,password")
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.message).toContain("password")
  })

  it("collapses a repeated column to its first position", () => {
    expect(columnsOf("id,amount,id")).toEqual(["id", "amount"])
  })

  it("includes last four only when it is asked for", () => {
    expect(columnsOf("id,last4")).toEqual(["id", "last4"])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("puts the scope label before the date", () => {
    const date = new Date("2026-08-13T12:00:00.000Z")
    expect(exportFilename(date, "disputed")).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename(date, "all")).toBe("payments-all-2026-08-13.csv")
  })
})

import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
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

  it("puts the scope label before the date", () => {
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })
})

describe("column selection (NWP-101)", () => {
  it("serializes a subset of columns in the order requested", () => {
    const parsed = parseExportColumns("amount,currency,id")
    expect(parsed).toEqual({ ok: true, value: ["amount", "currency", "id"] })
    if (!parsed.ok) throw new Error("expected columns to parse")
    expect(toCsv([payment], parsed.value)).toBe(
      ["amount,currency,id", "$250.00,USD,pay_0001"].join("\n"),
    )
  })

  it("excludes the card last four by default", () => {
    const parsed = parseExportColumns(null)
    if (!parsed.ok) throw new Error("expected defaults to parse")
    expect(parsed.value).not.toContain("last4")
    expect(parsed.value).toEqual(DEFAULT_EXPORT_COLUMNS)
    const csv = toCsv([payment], parsed.value)
    expect(csv.split("\n")[0].split(",")).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("").ok).toBe(false)
    expect(parseExportColumns(" , ,").ok).toBe(false)
  })

  it("rejects a column that is not on the allowlist", () => {
    expect(parseExportColumns("id,card_number")).toEqual({
      ok: false,
      message: "Unknown export column: card_number",
    })
  })

  it("keeps last four when it is asked for, and drops duplicates", () => {
    expect(parseExportColumns("id,last4,id")).toEqual({ ok: true, value: ["id", "last4"] })
  })
})

describe("export scope", () => {
  it("defaults to the current filter and rejects unknown scopes", () => {
    expect(parseExportScope(null)).toEqual({ ok: true, value: "filtered" })
    expect(parseExportScope("all")).toEqual({ ok: true, value: "all" })
    expect(parseExportScope("everything").ok).toBe(false)
  })

  it("labels the file from allowlisted values only", () => {
    expect(exportLabel("filtered", { status: "disputed" })).toBe("disputed")
    expect(exportLabel("filtered", { status: "all", search: "acme" })).toBe("filtered")
    expect(exportLabel("filtered", { status: "all" })).toBe("all")
    expect(exportLabel("all", { status: "disputed" })).toBe("all")
  })
})

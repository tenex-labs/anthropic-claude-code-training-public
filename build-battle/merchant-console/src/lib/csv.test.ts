import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeLabel,
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

  it("strips anything from the label that could break the header", () => {
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), 'x";\r\n/..')).toBe(
      "payments-x-2026-08-13.csv",
    )
  })
})

describe("column selection (NWP-101)", () => {
  it("writes a subset of columns in the order requested", () => {
    const columns = parseExportColumns("amount,status,id")
    expect(columns).toEqual({ ok: true, value: ["amount", "status", "id"] })
    if (!columns.ok) return
    expect(toCsv([payment], columns.value)).toBe(
      ["amount,status,id", "$250.00,captured,pay_0001"].join("\n"),
    )
  })

  it("excludes the card last four by default", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    const columns = parseExportColumns(null)
    expect(columns).toEqual({ ok: true, value: [...DEFAULT_EXPORT_COLUMNS] })
    if (!columns.ok) return
    const csv = toCsv([payment], columns.value)
    expect(csv.split("\n")[0]).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("keeps every other column in the default set", () => {
    expect([...DEFAULT_EXPORT_COLUMNS, "last4"].sort()).toEqual([...EXPORT_COLUMNS].sort())
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      ok: false,
      error: "Choose at least one column to export.",
    })
    expect(parseExportColumns(" , ,")).toMatchObject({ ok: false })
  })

  it("rejects an unknown column without echoing it back", () => {
    const result = parseExportColumns("id,card_number")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).not.toContain("card_number")
  })

  it("drops duplicate columns and keeps the first position", () => {
    expect(parseExportColumns("id,amount,id")).toEqual({ ok: true, value: ["id", "amount"] })
  })
})

describe("export scope", () => {
  it("defaults to the current filter", () => {
    expect(parseExportScope(null)).toEqual({ ok: true, value: "filtered" })
    expect(parseExportScope("")).toEqual({ ok: true, value: "filtered" })
  })

  it("accepts all and rejects anything else", () => {
    expect(parseExportScope("all")).toEqual({ ok: true, value: "all" })
    expect(parseExportScope("everything")).toMatchObject({ ok: false })
  })

  it("labels the file by status, other filters, or all", () => {
    expect(exportScopeLabel("filtered", { status: "disputed" })).toBe("disputed")
    expect(exportScopeLabel("filtered", { status: "all", search: "coffee" })).toBe("filtered")
    expect(exportScopeLabel("filtered", { status: "all" })).toBe("all")
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
  })
})

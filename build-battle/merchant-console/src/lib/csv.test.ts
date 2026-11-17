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

describe("parseExportColumns", () => {
  it("keeps a subset of columns in the order requested", () => {
    const parsed = parseExportColumns("amount, id,currency")
    expect(parsed).toEqual({ ok: true, columns: ["amount", "id", "currency"] })
    if (!parsed.ok) return
    expect(toCsv([payment], parsed.columns)).toBe(
      ["amount,id,currency", "$250.00,pay_0001,USD"].join("\n"),
    )
  })

  it("excludes the card last four by default and keeps everything else in file order", () => {
    const parsed = parseExportColumns(null)
    expect(parsed).toEqual({
      ok: true,
      columns: EXPORT_COLUMNS.filter((column) => column !== "last4"),
    })
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(toCsv([payment])).toContain("4242")
    if (!parsed.ok) return
    expect(toCsv([payment], parsed.columns)).not.toContain("4242")
  })

  it("includes the last four only when it is asked for", () => {
    expect(parseExportColumns("id,last4")).toEqual({
      ok: true,
      columns: ["id", "last4"],
    })
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    for (const raw of ["", " ", ",", " , "]) {
      expect(parseExportColumns(raw)).toEqual({
        ok: false,
        error: "Choose at least one column to export.",
      })
    }
  })

  it("rejects a column that is not on the allowlist", () => {
    const parsed = parseExportColumns("id,card_number")
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain("card_number")
  })

  it("drops duplicates, keeping the first position", () => {
    expect(parseExportColumns("id,amount,id")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter for anything but 'all'", () => {
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("filter")).toBe("filter")
    expect(parseExportScope(null)).toBe("filter")
    expect(parseExportScope("everything")).toBe("filter")
  })
})

describe("exportScopeLabel", () => {
  it("names the status, 'filtered', or 'all'", () => {
    expect(exportScopeLabel("filter", "disputed")).toBe("disputed")
    expect(exportScopeLabel("filter", "all")).toBe("filtered")
    expect(exportScopeLabel("filter", undefined)).toBe("filtered")
    expect(exportScopeLabel("all", "disputed")).toBe("all")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("puts the scope before the date", () => {
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })
})

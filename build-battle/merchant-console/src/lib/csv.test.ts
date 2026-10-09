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

  it("puts the scope label between the prefix and the date", () => {
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })
})

describe("parseExportColumns", () => {
  it("returns a subset in the order requested, and toCsv honours it", () => {
    const parsed = parseExportColumns("amount,id,status")
    expect(parsed).toEqual({ ok: true, value: ["amount", "id", "status"] })
    if (!parsed.ok) throw new Error("expected a valid selection")
    expect(toCsv([payment], parsed.value)).toBe(
      ["amount,id,status", "$250.00,pay_0001,captured"].join("\n"),
    )
  })

  it("excludes card last four by default, and keeps every other column", () => {
    const parsed = parseExportColumns(null)
    if (!parsed.ok) throw new Error("expected the default selection")
    expect(parsed.value).not.toContain("last4")
    expect(parsed.value).toEqual(EXPORT_COLUMNS.filter((c) => c !== "last4"))
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(toCsv([payment], parsed.value)).not.toContain("4242")
  })

  it("rejects an empty selection rather than writing an empty file", () => {
    expect(parseExportColumns("").ok).toBe(false)
    expect(parseExportColumns(" , ,").ok).toBe(false)
  })

  it("rejects a column that is not on the allowlist", () => {
    expect(parseExportColumns("id,password")).toEqual({
      ok: false,
      error: "Unknown export column: password",
    })
  })

  it("trims names and collapses duplicates", () => {
    expect(parseExportColumns(" id , amount,id")).toEqual({
      ok: true,
      value: ["id", "amount"],
    })
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter", () => {
    expect(parseExportScope(null)).toEqual({ ok: true, value: "filter" })
  })

  it("accepts all, and rejects anything else", () => {
    expect(parseExportScope("all")).toEqual({ ok: true, value: "all" })
    expect(parseExportScope("everything").ok).toBe(false)
  })
})

describe("exportScopeLabel", () => {
  it("labels an all-payments export as all, whatever the filters", () => {
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
  })

  it("names the status and a known merchant for a filtered export", () => {
    expect(
      exportScopeLabel("filter", { status: "disputed", merchantId: "mch_01" }),
    ).toBe("disputed-mch_01")
  })

  it("keeps client free text out of the filename", () => {
    expect(
      exportScopeLabel("filter", {
        merchantId: "../../etc",
        search: "Order 1180",
      }),
    ).toBe("search")
    expect(exportScopeLabel("filter", { status: "all" })).toBe("all")
  })
})

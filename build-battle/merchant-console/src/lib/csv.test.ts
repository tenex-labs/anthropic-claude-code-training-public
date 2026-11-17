import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
  parseColumns,
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
    expect(lines[0]).toBe(DEFAULT_EXPORT_COLUMNS.join(","))
  })

  it("leaves the card last four out when no columns are given", () => {
    const csv = toCsv([payment])
    expect(csv.split("\n")[0]).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("still writes every column, last four included, when asked for all of them", () => {
    expect(toCsv([payment], EXPORT_COLUMNS).split("\n")[0]).toBe(
      EXPORT_COLUMNS.join(","),
    )
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
    expect(
      exportFilename(new Date("2026-08-13T10:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("strips anything from the label that could alter the header", () => {
    expect(
      exportFilename(new Date("2026-08-13T10:00:00.000Z"), 'x"\r\nSet-Cookie: a'),
    ).toBe("payments-xsetcookiea-2026-08-13.csv")
  })
})

describe("column selection", () => {
  it("returns a subset of columns in the order requested", () => {
    const selection = parseColumns("amount,id,merchant")
    expect(selection).toEqual({ ok: true, columns: ["amount", "id", "merchant"] })
    if (!selection.ok) return
    expect(toCsv([payment], selection.columns)).toBe(
      ["amount,id,merchant", "$250.00,pay_0001,Lumen Coffee Roasters"].join("\n"),
    )
  })

  it("leaves the card last four out by default", () => {
    const selection = parseColumns(null)
    expect(selection.ok).toBe(true)
    if (!selection.ok) return
    expect(selection.columns).not.toContain("last4")
    expect(selection.columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(toCsv([payment], selection.columns)).not.toContain("4242")
  })

  it("includes the last four only when it is asked for", () => {
    const selection = parseColumns("id,last4")
    expect(selection).toEqual({ ok: true, columns: ["id", "last4"] })
  })

  it("rejects an empty selection instead of producing an empty file", () => {
    expect(parseColumns("")).toEqual({
      ok: false,
      error: "Select at least one column.",
    })
    expect(parseColumns("  ").ok).toBe(false)
  })

  it("rejects a column that is not on the allowlist", () => {
    const selection = parseColumns("id,password")
    expect(selection.ok).toBe(false)
    if (selection.ok) return
    expect(selection.error).toContain("password")
  })

  it("ignores a trailing or doubled comma instead of calling it a column", () => {
    expect(parseColumns("id,amount,")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
    expect(parseColumns("id,,amount")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })

  it("treats a selection of only commas as empty", () => {
    expect(parseColumns(",,")).toEqual({
      ok: false,
      error: "Select at least one column.",
    })
  })

  it("drops repeated columns and keeps the first position", () => {
    expect(parseColumns("id,amount,id")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })
})

describe("exportLabel", () => {
  it("names the status when one is filtered on", () => {
    expect(exportLabel("filter", { status: "disputed" })).toBe("disputed")
  })

  it("keeps the status even when other filters narrow it further", () => {
    expect(
      exportLabel("filter", { status: "disputed", merchantId: "mch_01" }),
    ).toBe("disputed")
  })

  it("says filtered when other filters narrow an unfiltered status", () => {
    expect(exportLabel("filter", { status: "all", search: "coffee" })).toBe(
      "filtered",
    )
    expect(exportLabel("filter", { merchantId: "mch_01" })).toBe("filtered")
    expect(exportLabel("filter", { from: "2026-08-01T00:00:00.000Z" })).toBe(
      "filtered",
    )
  })

  it("says all when nothing narrows the filter scope", () => {
    expect(exportLabel("filter", { status: "all" })).toBe("all")
    expect(exportLabel("filter", {})).toBe("all")
  })

  it("says all for the all-payments scope, whatever the filters were", () => {
    expect(exportLabel("all", { status: "disputed", search: "x" })).toBe("all")
  })
})

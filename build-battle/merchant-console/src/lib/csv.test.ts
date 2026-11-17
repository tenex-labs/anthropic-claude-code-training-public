import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeLabel,
  parseExportOptions,
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

// NWP-101: ops chooses the columns. These pin the serializer's side of that.
describe("column selection", () => {
  const params = (query: string) => new URLSearchParams(query)

  it("writes a subset of columns in the requested order, not the default order", () => {
    const [header, row] = toCsv([payment], ["currency", "id", "amount"]).split("\n")
    expect(header).toBe("currency,id,amount")
    expect(row).toBe("USD,pay_0001,$250.00")
  })

  it("keeps the requested order through validation and drops duplicates", () => {
    const options = parseExportOptions(params("columns=amount,id,amount,status"))
    expect(options).toEqual({
      ok: true,
      columns: ["amount", "id", "status"],
      scope: "filtered",
    })
  })

  it("excludes card last four by default", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)

    const options = parseExportOptions(params(""))
    if (!options.ok) throw new Error(options.message)
    expect(options.columns).not.toContain("last4")

    const csv = toCsv([payment], options.columns)
    expect(csv.split("\n")[0].split(",")).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("still includes last four when ops asks for it", () => {
    const options = parseExportOptions(params("columns=id,last4"))
    expect(options).toMatchObject({ ok: true, columns: ["id", "last4"] })
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportOptions(params("columns="))).toEqual({
      ok: false,
      message: "Choose at least one column to export.",
    })
    expect(parseExportOptions(params("columns=,,"))).toMatchObject({ ok: false })
    expect(() => toCsv([payment], [])).toThrow(RangeError)
  })

  it("rejects a column that is not on the allowlist", () => {
    expect(parseExportOptions(params("columns=id,card_number"))).toEqual({
      ok: false,
      message: 'Unknown export column "card_number".',
    })
  })

  it("defaults scope to the current filter and rejects unknown scopes", () => {
    expect(parseExportOptions(params("scope=all"))).toMatchObject({ ok: true, scope: "all" })
    expect(parseExportOptions(params("scope=everything"))).toMatchObject({ ok: false })
  })
})

describe("exportScopeLabel", () => {
  it("labels an all-payments export as all, whatever the filters say", () => {
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
  })

  it("builds the label from allowlisted filter values only", () => {
    expect(exportScopeLabel("filtered", { status: "disputed" })).toBe("disputed")
    expect(exportScopeLabel("filtered", { status: "all", merchantId: "mch_01" })).toBe("mch_01")
    expect(exportScopeLabel("filtered", { search: "../etc/passwd" })).toBe("search")
  })

  it("leaves out a merchant the store does not know", () => {
    expect(exportScopeLabel("filtered", { merchantId: 'x"; evil' })).toBe("filtered")
  })
})

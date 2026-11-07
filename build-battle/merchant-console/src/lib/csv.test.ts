import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import { parseFilters } from "@/data/queries"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  parseExportRequest,
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
})

describe("column selection (NWP-101)", () => {
  it("writes a requested subset of columns in the order requested", () => {
    const parsed = parseExportColumns("amount,id,status")
    expect(parsed).toEqual({ ok: true, value: ["amount", "id", "status"] })
    if (!parsed.ok) return
    expect(toCsv([payment], parsed.value)).toBe(
      ["amount,id,status", "$250.00,pay_0001,captured"].join("\n"),
    )
  })

  it("leaves the card last four out by default", () => {
    const parsed = parseExportColumns(null)
    expect(parsed).toEqual({ ok: true, value: [...DEFAULT_EXPORT_COLUMNS] })
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)
    const header = toCsv([payment], DEFAULT_EXPORT_COLUMNS).split("\n")[0]
    expect(header.split(",")).not.toContain("last4")
    expect(toCsv([payment], DEFAULT_EXPORT_COLUMNS)).not.toContain("4242")
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      ok: false,
      error: "Select at least one column.",
    })
    expect(() => toCsv([payment], [])).toThrow(RangeError)
  })

  it("rejects unknown, repeated, and malformed column names", () => {
    expect(parseExportColumns("id,card_number").ok).toBe(false)
    expect(parseExportColumns("id,id").ok).toBe(false)
    expect(parseExportColumns("id,").ok).toBe(false)
    expect(parseExportColumns(" id").ok).toBe(false)
    expect(parseExportColumns("ID").ok).toBe(false)
  })

  it("accepts only the current and all scopes, defaulting to current", () => {
    expect(parseExportScope(null)).toEqual({ ok: true, value: "current" })
    expect(parseExportScope("all")).toEqual({ ok: true, value: "all" })
    expect(parseExportScope("everything").ok).toBe(false)
  })
})

describe("parseExportRequest", () => {
  const day = new Date("2026-08-13T12:00:00.000Z")

  it("ignores the URL's filters, in the query and the filename, when scope is all", () => {
    const parsed = parseExportRequest(
      new URLSearchParams("scope=all&status=disputed&merchantId=mch_01"),
      day,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.filters.status).toBe("all")
    expect(parsed.value.filters.merchantId).toBeUndefined()
    expect(parsed.value.filename).toBe("payments-all-2026-08-13.csv")
  })

  it("keeps the current filter and the requested columns", () => {
    const parsed = parseExportRequest(
      new URLSearchParams("status=disputed&columns=id,amount"),
      day,
    )
    expect(parsed.ok && parsed.value.filters.status).toBe("disputed")
    expect(parsed.ok && parsed.value.columns).toEqual(["id", "amount"])
    expect(parsed.ok && parsed.value.filename).toBe("payments-disputed-2026-08-13.csv")
  })

  it("returns the first validation error and no request", () => {
    expect(parseExportRequest(new URLSearchParams("columns=id,bogus")).ok).toBe(false)
    expect(parseExportRequest(new URLSearchParams("scope=nope")).ok).toBe(false)
  })
})

describe("exportFilename with a scope", () => {
  const day = new Date("2026-08-13T23:00:00.000Z")
  const current = (query: string) =>
    exportFilename(day, { scope: "current", filters: parseFilters(new URLSearchParams(query)) })

  it.each([
    ["status=disputed", "payments-disputed-2026-08-13.csv"],
    ["merchantId=mch_01", "payments-lumen-coffee-roasters-2026-08-13.csv"],
    ["merchantId=mch_01&status=disputed", "payments-lumen-coffee-roasters-disputed-2026-08-13.csv"],
    ["search=1180", "payments-filtered-2026-08-13.csv"],
    ["search=%20%20", "payments-all-2026-08-13.csv"],
    ["from=2026-08-01", "payments-filtered-2026-08-13.csv"],
    ["merchantId=mch_unknown", "payments-filtered-2026-08-13.csv"],
    ["merchantId=..%2F..%2Fetc", "payments-filtered-2026-08-13.csv"],
    ["", "payments-all-2026-08-13.csv"],
  ])("current filter %j → %s", (query, expected) => {
    expect(current(query)).toBe(expected)
  })

  it("names an all-payments export 'all' whatever the filters say", () => {
    const filters = parseFilters(new URLSearchParams("status=disputed&merchantId=mch_01"))
    expect(exportFilename(day, { scope: "all", filters })).toBe("payments-all-2026-08-13.csv")
  })
})

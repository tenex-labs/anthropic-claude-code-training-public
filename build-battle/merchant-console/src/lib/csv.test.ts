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
})

describe("parseExportColumns", () => {
  const columnsOf = (raw: string | null) => {
    const parsed = parseExportColumns(raw)
    if (!parsed.ok) throw new Error(parsed.error)
    return parsed.value
  }

  it("keeps a subset of columns in the order requested", () => {
    expect(columnsOf("amount,id,currency")).toEqual(["amount", "id", "currency"])
  })

  it("serializes that subset in the same order", () => {
    expect(toCsv([payment], columnsOf("currency,id"))).toBe(
      ["currency,id", "USD,pay_0001"].join("\n"),
    )
  })

  it("excludes the card last four by default", () => {
    expect(columnsOf(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(columnsOf(null)).not.toContain("last4")
    expect(toCsv([payment], columnsOf(null))).not.toContain("4242")
  })

  it("includes the last four only when asked for", () => {
    expect(columnsOf("id,last4")).toEqual(["id", "last4"])
  })

  it("rejects an empty selection rather than writing an empty file", () => {
    expect(parseExportColumns("").ok).toBe(false)
    expect(parseExportColumns(" , ").ok).toBe(false)
  })

  it("rejects any column outside the allowlist", () => {
    expect(parseExportColumns("id,password").ok).toBe(false)
    expect(parseExportColumns("id,merchantId").ok).toBe(false)
  })

  it("drops duplicates", () => {
    expect(columnsOf("id,amount,id")).toEqual(["id", "amount"])
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
  it("names the status filter", () => {
    expect(exportScopeLabel("filter", { status: "disputed" })).toBe("disputed")
  })

  it("adds a merchant id only when it is a real merchant", () => {
    expect(
      exportScopeLabel("filter", { status: "captured", merchantId: "mch_01" }),
    ).toBe("captured-mch_01")
    expect(
      exportScopeLabel("filter", { merchantId: "../../etc/passwd" }),
    ).toBe("filtered")
  })

  it("never puts free-text search into the filename", () => {
    expect(exportScopeLabel("filter", { search: "Lumen" })).toBe("filtered")
  })

  it("labels the all-payments scope, whatever the filters say", () => {
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
  })
})

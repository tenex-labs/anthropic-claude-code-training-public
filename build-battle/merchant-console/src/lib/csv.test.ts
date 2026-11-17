import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
  filtersForScope,
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

/**
 * NWP-101: ops chooses the columns. The column list arrives from the browser,
 * so it is parsed against the allowlist on the server before it reaches the
 * serializer.
 */
describe("export column selection", () => {
  it("writes a subset of columns in the order requested", () => {
    const parsed = parseExportColumns("amount,id,status")
    expect(parsed).toEqual({ ok: true, value: ["amount", "id", "status"] })
    if (!parsed.ok) return

    expect(toCsv([payment], parsed.value)).toBe(
      ["amount,id,status", "$250.00,pay_0001,captured"].join("\n"),
    )
  })

  it("trims spaces and keeps a repeated column at its first position", () => {
    expect(parseExportColumns(" id , amount,id ")).toEqual({
      ok: true,
      value: ["id", "amount"],
    })
  })

  it("excludes the card last four by default", () => {
    const parsed = parseExportColumns(null)
    expect(parsed).toEqual({ ok: true, value: [...DEFAULT_EXPORT_COLUMNS] })
    if (!parsed.ok) return

    expect(parsed.value).not.toContain("last4")
    expect(parsed.value).toHaveLength(EXPORT_COLUMNS.length - 1)

    const csv = toCsv([payment], parsed.value)
    expect(csv.split("\n")[0]).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("includes the card last four only when it is asked for", () => {
    const parsed = parseExportColumns("id,last4")
    expect(parsed).toEqual({ ok: true, value: ["id", "last4"] })
    if (!parsed.ok) return

    expect(toCsv([payment], parsed.value)).toBe(
      ["id,last4", "pay_0001,4242"].join("\n"),
    )
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    for (const raw of ["", " ", ",", " , "]) {
      const parsed = parseExportColumns(raw)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.error).toMatch(/at least one column/)
    }
  })

  it("rejects an unknown column instead of silently dropping it", () => {
    for (const raw of ["id,card_number", "ID", "id;amount", "__proto__"]) {
      expect(parseExportColumns(raw).ok).toBe(false)
    }
  })
})

describe("export scope", () => {
  it("defaults to the current filter and accepts all payments", () => {
    expect(parseExportScope(null)).toEqual({ ok: true, value: "filtered" })
    expect(parseExportScope("all")).toEqual({ ok: true, value: "all" })
  })

  it("rejects any other scope", () => {
    expect(parseExportScope("everything").ok).toBe(false)
    expect(parseExportScope("").ok).toBe(false)
  })

  it("clears every filter for all payments but keeps the sort", () => {
    const filters = {
      status: "disputed" as const,
      merchantId: "mch_01",
      search: "order",
      sort: "amount" as const,
      direction: "asc" as const,
    }
    expect(filtersForScope(filters, "filtered")).toBe(filters)
    expect(filtersForScope(filters, "all")).toEqual({
      status: "all",
      sort: "amount",
      direction: "asc",
    })
  })

  it("labels the file by scope, using only validated values", () => {
    expect(exportLabel("all", { status: "disputed" })).toBe("all")
    expect(exportLabel("filtered", { status: "disputed" })).toBe("disputed")
    expect(exportLabel("filtered", { status: "all" })).toBe("filtered")
    expect(exportLabel("filtered", {})).toBe("filtered")
  })
})

import { describe, expect, it } from "vitest"
import {
  MAX_SEARCH_LENGTH,
  parseFilters,
  validateFilterParams,
} from "./queries"

const params = (query: string) => new URLSearchParams(query)

describe("validateFilterParams", () => {
  it("accepts a known merchant, a short search and UTC dates", () => {
    expect(
      validateFilterParams(
        params("merchantId=mch_01&search=order&from=2026-03-01&to=2026-03-14T23:59:59Z"),
      ),
    ).toBeNull()
  })

  it("accepts no filters at all", () => {
    expect(validateFilterParams(params(""))).toBeNull()
  })

  it("rejects a merchant that does not exist rather than dropping it", () => {
    expect(validateFilterParams(params("merchantId=mch_missing"))).toBe(
      "Unknown merchant.",
    )
  })

  it("rejects a search longer than the limit", () => {
    const long = "a".repeat(MAX_SEARCH_LENGTH + 1)
    expect(validateFilterParams(params(`search=${long}`))).toMatch(/characters or fewer/)
    expect(
      validateFilterParams(params(`search=${"a".repeat(MAX_SEARCH_LENGTH)}`)),
    ).toBeNull()
  })

  it("rejects dates that are not UTC dates", () => {
    for (const bad of [
      "yesterday",
      "2026-13-01",
      "2026-02-31",
      "2026-03-14T10:00:00",
      "2026-03-14T10:00:00+02:00",
      "14/03/2026",
    ]) {
      expect(validateFilterParams(params(`from=${encodeURIComponent(bad)}`))).toMatch(
        /^"from" must be a UTC date/,
      )
      expect(validateFilterParams(params(`to=${encodeURIComponent(bad)}`))).toMatch(
        /^"to" must be a UTC date/,
      )
    }
  })

  it("rejects a range that ends before it starts", () => {
    expect(validateFilterParams(params("from=2026-03-14&to=2026-03-01"))).toBe(
      '"from" must be on or before "to".',
    )
  })
})

describe("parseFilters", () => {
  it("normalizes dates to UTC ISO timestamps", () => {
    const filters = parseFilters(params("from=2026-03-01&to=2026-03-14T23:59Z"))
    expect(filters.from).toBe("2026-03-01T00:00:00.000Z")
    expect(filters.to).toBe("2026-03-14T23:59:00.000Z")
  })

  it("never passes an unknown merchant or a bad date on to the query", () => {
    const filters = parseFilters(params("merchantId=mch_missing&from=yesterday"))
    expect(filters.merchantId).toBeUndefined()
    expect(filters.from).toBeUndefined()
  })

  it("keeps a known merchant", () => {
    expect(parseFilters(params("merchantId=mch_01")).merchantId).toBe("mch_01")
  })
})

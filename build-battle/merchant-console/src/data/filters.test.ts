import { describe, expect, it } from "vitest"
import { filterPayments, filtersToParams, parseFilters } from "./queries"

/**
 * The payments page, its row count and the export all read the URL through
 * parseFilters, and the export link is written by filtersToParams. If the two
 * ever disagree, the count promised in the export panel stops matching the
 * file, so they are pinned against each other here.
 */

const parse = (query: string) => parseFilters(new URLSearchParams(query))

describe("filtersToParams", () => {
  it("writes nothing for the default filters", () => {
    expect(filtersToParams(parse("")).toString()).toBe("")
  })

  it("writes every filter the page can apply, and leaves page out", () => {
    const params = filtersToParams(
      parse(
        "status=disputed&merchantId=mch_01&search=coffee" +
          "&from=2026-08-01T00:00:00.000Z&to=2026-08-02T00:00:00.000Z" +
          "&sort=amount&direction=asc&page=3",
      ),
    )
    expect(Object.fromEntries(params)).toEqual({
      status: "disputed",
      merchantId: "mch_01",
      search: "coffee",
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-02T00:00:00.000Z",
      sort: "amount",
      direction: "asc",
    })
  })

  it("leaves out a status of all and the default sort", () => {
    const params = filtersToParams(parse("status=all&sort=createdAt&direction=desc"))
    expect(params.toString()).toBe("")
  })

  it("reads back as the same filters it was written from", () => {
    const queries = [
      "status=refunded",
      "merchantId=mch_02&search=order",
      "from=2026-08-01T00:00:00.000Z&sort=amount",
      "status=failed&direction=asc&page=2",
    ]
    for (const query of queries) {
      const original = parse(query)
      const roundTrip = parseFilters(filtersToParams(original))
      expect(roundTrip).toEqual({ ...original, page: 1 })
    }
  })

  it("selects the same payments after the round trip", () => {
    const original = parse("status=disputed&from=2026-07-01T00:00:00.000Z")
    const roundTrip = parseFilters(filtersToParams(original))
    expect(filterPayments(roundTrip).map((p) => p.id)).toEqual(
      filterPayments(original).map((p) => p.id),
    )
    expect(filterPayments(original).length).toBeGreaterThan(0)
  })
})

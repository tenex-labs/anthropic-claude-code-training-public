import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { filterPayments, PAGE_SIZE, parseFilters } from "@/data/queries"
import { GET } from "./route"

/**
 * The payments table is paginated; the export must not be. NWP-101 calls out
 * "exports the current page only" as the bug to avoid, and nothing in the
 * csv helpers would catch a route that switched to queryPayments. These pin
 * the route itself.
 */

function exportRequest(query: string) {
  return new NextRequest(`http://localhost/api/payments/export?${query}`)
}

/** Data rows in a CSV body, using `id` only so no cell contains a newline. */
async function dataRows(response: Response): Promise<string[]> {
  const lines = (await response.text()).split("\n")
  expect(lines[0]).toBe("id")
  return lines.slice(1)
}

describe("GET /api/payments/export", () => {
  it("exports every payment, not one page, and ignores the page param", async () => {
    const response = GET(exportRequest("page=2&columns=id"))
    expect(response.status).toBe(200)

    const rows = await dataRows(response)
    const expected = filterPayments(parseFilters(new URLSearchParams()))
    expect(expected.length).toBeGreaterThan(PAGE_SIZE)
    expect(rows).toHaveLength(expected.length)
  })

  it("exports every row matching the current filter across pages", async () => {
    const response = GET(exportRequest("status=captured&page=3&columns=id"))
    const rows = await dataRows(response)
    const expected = filterPayments(
      parseFilters(new URLSearchParams("status=captured")),
    )
    expect(expected.length).toBeGreaterThan(PAGE_SIZE)
    expect(rows).toHaveLength(expected.length)
  })

  it("ignores the filters when scope is all", async () => {
    const response = GET(exportRequest("status=disputed&scope=all&columns=id"))
    const rows = await dataRows(response)
    const everything = filterPayments(parseFilters(new URLSearchParams()))
    expect(rows).toHaveLength(everything.length)
    expect(response.headers.get("content-disposition")).toMatch(
      /filename="payments-all-\d{4}-\d{2}-\d{2}\.csv"/,
    )
  })

  it("rejects an empty column selection with a 400", async () => {
    const response = GET(exportRequest("columns="))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Choose at least one column to export.",
    })
  })
})

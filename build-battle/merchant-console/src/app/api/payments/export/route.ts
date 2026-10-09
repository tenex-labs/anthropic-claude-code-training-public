import { parseFilters, queryAllPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const

/**
 * Exports payments as CSV.
 *
 * Runs on the server against every matching row, not the page on screen, and
 * goes through the same query builder as `GET /api/payments`. Columns and
 * scope come from the client and are checked against allowlists first.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!SCOPES.includes(scope as (typeof SCOPES)[number])) {
    return NextResponse.json({ error: "Unknown export scope." }, { status: 400 })
  }

  const selection = parseExportColumns(params.get("columns"))
  if ("error" in selection) {
    return NextResponse.json({ error: selection.error }, { status: 400 })
  }

  const parsed = parseFilters(params)
  const filters: PaymentFilters =
    scope === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed
  const rows = queryAllPayments(filters)

  return new Response(toCsv(rows, selection.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), filenameLabel(filters))}"`,
    },
  })
}

/** Built only from allowlisted values; raw search or merchant input never reaches the header. */
function filenameLabel(filters: PaymentFilters): string {
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

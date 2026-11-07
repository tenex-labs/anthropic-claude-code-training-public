import { filterPayments, sortPayments } from "@/data/queries"
import { parseExportRequest, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope come from the client and are validated by
 * `parseExportRequest` before anything touches the query builder or the
 * filename. Every filtered row is exported, not one page.
 */
export function GET(request: NextRequest) {
  const parsed = parseExportRequest(request.nextUrl.searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { columns, filters, filename } = parsed.value
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

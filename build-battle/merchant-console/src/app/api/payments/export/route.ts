import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` and `scope` come from the client, so both are checked against an
 * allowlist before anything runs. Rows come from the shared query builder:
 * the current filters, or none at all for `scope=all`. Never paginated.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) return NextResponse.json({ error: scope.message }, { status: 400 })

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) {
    return NextResponse.json({ error: columns.message }, { status: 400 })
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope.value === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportLabel(scope.value, filters))

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

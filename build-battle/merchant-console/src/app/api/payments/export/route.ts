import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` (comma-separated) and `scope` (`filter` | `all`) come from the
 * client, so both are validated against allowlists before the query runs.
 * Rows come from the shared query builder, unpaginated, so the file holds
 * every matching payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) {
    return NextResponse.json({ error: columns.error }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: 400 })
  }

  const parsed = parseFilters(params)
  const filters =
    scope.value === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(
    new Date(),
    exportScopeLabel(scope.value, filters),
  )

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

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
 * Exports payments as CSV (NWP-101).
 *
 * Built on the server, through the same query builder as GET /api/payments,
 * so the file holds every matching row and not just the page on screen.
 *
 * Query params, on top of the usual filters:
 * - `columns`: comma-separated, checked against EXPORT_COLUMNS. Defaults
 *   exclude the card last four.
 * - `scope`: `filter` (default) honours the filters; `all` ignores them.
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

  // "All payments" drops the filters but keeps the caller's sort order.
  const filters =
    scope.value === "all"
      ? parseFilters(onlySortParams(params))
      : parseFilters(params)

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

function onlySortParams(params: URLSearchParams): URLSearchParams {
  const kept = new URLSearchParams()
  for (const key of ["sort", "direction"]) {
    const value = params.get(key)
    if (value) kept.set(key, value)
  }
  return kept
}

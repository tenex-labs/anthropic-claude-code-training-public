import {
  filterPayments,
  parseFilters,
  sortPayments,
  validateFilterParams,
} from "@/data/queries"
import {
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

/**
 * Exports payments as CSV (NWP-101).
 *
 * Runs on the server through the same query builder as GET /api/payments,
 * without pagination, so the file holds every matching row rather than the
 * page on screen. Columns and scope are validated before any data is read.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.message)

  const scope = parseExportScope(params.get("scope"))
  if (!scope) return badRequest('Scope must be "filter" or "all".')

  const invalidFilter = validateFilterParams(params)
  if (invalidFilter) return badRequest(invalidFilter)

  const current = parseFilters(params)
  // "All payments" still goes through the builder, just with no filters.
  const filters =
    scope === "all"
      ? {
          ...parseFilters(new URLSearchParams()),
          sort: current.sort,
          direction: current.direction,
        }
      : current

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportScopeLabel(scope, current))

  return new Response(toCsv(rows, columns.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

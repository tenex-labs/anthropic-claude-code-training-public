import {
  filterPayments,
  filtersForScope,
  parseFilters,
  sortPayments,
} from "@/data/queries"
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
 * Query params, all validated here before use:
 * - `columns`: comma-separated names from EXPORT_COLUMNS. Missing means the
 *   defaults (no card last four). Empty or unknown names are a 400.
 * - `scope`: `filter` (default) or `all`.
 * - the usual payment filters, via parseFilters.
 *
 * Rows come from the shared query builder and are never paginated, so the
 * file holds every matching payment, not just the visible page.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.error)

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) return badRequest(scope.error)

  const filters = filtersForScope(parseFilters(params), scope.value)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(
    new Date(),
    exportScopeLabel(filters, scope.value),
  )

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

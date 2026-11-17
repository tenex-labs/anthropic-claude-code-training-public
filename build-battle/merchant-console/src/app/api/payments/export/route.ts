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
 * Query parameters, all validated here before anything is read:
 * - `scope`: `filter` (default) honors the payments filters; `all` ignores them.
 * - `columns`: comma-separated names from EXPORT_COLUMNS, in output order.
 *   Missing means the default set, which leaves out the card last four.
 * - the usual payments filters, read by parseFilters.
 *
 * Rows go through the shared query builder unpaginated, so the file holds
 * every matching payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = parseExportScope(params.get("scope"))
  if (!scope) return badRequest('Scope must be "filter" or "all".')

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.error)

  const filters = parseFilters(scope === "all" ? new URLSearchParams() : params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportLabel(filters))

  return new Response(toCsv(rows, columns.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

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
 * Query parameters:
 * - `scope`: allowlisted here. `filter` (default) honors the payments
 *   filters; `all` ignores them.
 * - `columns`: allowlisted here. Comma-separated names from EXPORT_COLUMNS,
 *   in output order. Missing means the default set, which leaves out the
 *   card last four.
 * - the payments filters, read by parseFilters. It allowlists status, sort
 *   and direction. merchantId, search, from and to pass through unchecked;
 *   they are only compared in memory and never reach the filename.
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

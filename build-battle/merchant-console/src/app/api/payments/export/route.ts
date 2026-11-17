import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  filtersForScope,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Query parameters, all validated before use:
 * - the usual payment filters, through `parseFilters()`
 * - `scope`: `filtered` (default) or `all`
 * - `columns`: comma-separated names from `EXPORT_COLUMNS`. Absent means the
 *   default set, which leaves out the card last four
 *
 * Bad input gets a 400 with `{ error }`, never a partial or empty file.
 * Every matching row is exported, not just the page on screen.
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

  const filters = filtersForScope(parseFilters(params), scope.value)
  const rows = sortPayments(
    filterPayments(filters),
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

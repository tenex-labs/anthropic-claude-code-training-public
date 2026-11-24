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
 * Exports payments as CSV, built here rather than in the browser so the file
 * covers every matching row, not the page on screen.
 *
 * - `columns`: comma-separated, checked against the allowlist in csv.ts.
 *   Missing means the defaults, which leave out card last four.
 * - `scope`: `current` (default) honors the filters; `all` ignores them.
 *
 * Filtering goes through the one query builder. There is no `paginate` here.
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
      ? { status: "all" as const, sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(filterPayments(filters), filters.sort, filters.direction)
  const filename = exportFilename(new Date(), exportLabel(scope.value, filters))

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

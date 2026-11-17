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
 * Query params:
 * - the usual payment filters, read by `parseFilters`
 * - `scope`: `filter` (default) or `all`
 * - `columns`: comma-separated column names; absent means every column but
 *   the card last four
 *
 * Every row that matches is exported, not one page, and filtering goes
 * through the one query builder for both scopes.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const parsed = parseExportColumns(params.get("columns"))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const filters = parseFilters(params)
  const scope = parseExportScope(params.get("scope"))
  const matching = filterPayments(scope === "all" ? {} : filters)
  const rows = sortPayments(matching, filters.sort, filters.direction)

  const filename = exportFilename(
    new Date(),
    exportScopeLabel(scope, filters.status),
  )

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

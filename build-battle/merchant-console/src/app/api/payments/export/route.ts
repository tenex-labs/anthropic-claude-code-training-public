import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportScopeLabel,
  parseExportOptions,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports payments as CSV.
 *
 * `scope=filtered` (default) honors the active filters; `scope=all` ignores
 * them but keeps the sort. `columns` picks and orders the columns; without it
 * the defaults apply, which leave out the card last four. Both go through
 * `parseExportOptions` before anything else, and filtering goes through the
 * one query builder either way.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const options = parseExportOptions(params)
  if (!options.ok) {
    return NextResponse.json({ error: options.message }, { status: 400 })
  }

  const filterParams =
    options.scope === "all" ? sortOnly(params) : params
  const filters = parseFilters(filterParams)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(
    new Date(),
    exportScopeLabel(options.scope, filters),
  )

  return new Response(toCsv(rows, options.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

function sortOnly(params: URLSearchParams): URLSearchParams {
  const kept = new URLSearchParams()
  for (const key of ["sort", "direction"]) {
    const value = params.get(key)
    if (value !== null) kept.set(key, value)
  }
  return kept
}

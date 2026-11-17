import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, exportLabel, parseColumns, parseScope, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports payments as CSV (NWP-101).
 *
 * - `columns`: comma-separated, checked against the allowlist in `csv.ts`.
 *   Omitted means every column except the card last four.
 * - `scope`: `current` (default) honors the active filters, `all` ignores them.
 *
 * Rows come from the shared query builder and are never paginated, so the
 * file covers every matching payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseColumns(params.get("columns"))
  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Choose at least one valid column to export." },
      { status: 400 },
    )
  }

  const scope = parseScope(params.get("scope"))
  const parsed = parseFilters(params)
  const filters: PaymentFilters =
    scope === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportLabel(scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

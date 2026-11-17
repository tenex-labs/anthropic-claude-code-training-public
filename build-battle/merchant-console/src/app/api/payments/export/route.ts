import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/**
 * Exports payments as CSV.
 *
 * `columns` (comma-separated) and `scope` (`filtered` | `all`) are validated
 * against allowlists before anything else runs. Rows come from the shared
 * query builder and are never paginated, so the file holds every match.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.error)

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) return badRequest(scope.error)

  const parsed = parseFilters(params)
  const filters: PaymentFilters =
    scope.value === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportScopeLabel(scope.value, filters))

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

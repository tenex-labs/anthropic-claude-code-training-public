import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  ExportScope,
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports payments as CSV.
 *
 * `columns` (comma-separated, allowlisted) picks what ships; last four is off
 * unless requested. `scope` is `filter` (the active filters, the default) or
 * `all`. Both scopes go through the one query builder, and the export is
 * never paginated: it writes every matching row.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.error)

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) return badRequest(scope.error)

  const filters = parseFilters(
    scope.value === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), scopeLabel(scope.value, filters))

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

/** Built only from allowlisted values, so it is safe in a filename. */
function scopeLabel(scope: ExportScope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const narrowed =
    filters.merchantId || filters.search || filters.from || filters.to
  return narrowed ? "filtered" : "all"
}
